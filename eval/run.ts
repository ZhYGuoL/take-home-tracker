// Measures extraction approaches on a fictional test set (D14). Run: pnpm eval --help
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mergeProposals, proposalFromReading } from '../src/core/extract/model'
import { classifyWithJev, type ModelCall, readWithModel } from '../src/core/extract/openrouter'
import { extractWithRules } from '../src/core/extract/rules'
import type { ExtractContext, Proposal } from '../src/core/extract/types'
import { CASES, ROSTER } from './cases'
import { HOLDOUT, HOLDOUT_ROSTER } from './holdout'
import { HOLDOUT2, HOLDOUT2_ROSTER } from './holdout2'
import { FIELDS, ratio, score } from './score'
import type { Case, RosterEntry } from './types'

const SETS: Record<string, { cases: Case[]; roster: RosterEntry[]; self: ExtractContext['self'] }> =
  {
    dev: { cases: CASES, roster: ROSTER, self: { name: 'Rae Lin', email: 'rae@example.com' } },
    dev2: {
      cases: HOLDOUT,
      roster: HOLDOUT_ROSTER,
      self: { name: 'Jo Park', email: 'jo.park@example.com' },
    },
    blind: {
      cases: HOLDOUT2,
      roster: HOLDOUT2_ROSTER,
      self: { name: 'Sam Ortega', email: 'sam.ortega@example.com' },
    },
  }

export const DEFAULT_MODELS = [
  'openai/gpt-5.4-nano',
  'google/gemini-3.1-flash-lite',
  'anthropic/claude-haiku-4.5',
  'deepseek/deepseek-v4-flash',
]
const JEV = 'jev-1.13'

const EMPTY: Proposal = {
  name: null,
  contacts: [],
  role: null,
  source: null,
  direction: 'in',
  messageAt: null,
  links: [],
  deadline: null,
  needsReply: false,
  match: null,
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

interface Row {
  approach: string
  fields: Record<string, string>
  ms: number | null
  cost: number | null
  errors: number
}

async function main() {
  if (process.argv.includes('--help')) {
    process.stdout.write(
      'pnpm eval [--set blind|dev|dev2] [--models a,b] [--jev] [--limit N] [--no-self]\n' +
        'Without OPENROUTER_API_KEY in .env, only the rules are measured.\n',
    )
    return
  }
  try {
    process.loadEnvFile(resolve(import.meta.dirname, '../.env'))
  } catch {
    // No .env file. The key can also come from the shell.
  }
  const setName = arg('set', 'blind')
  const set = SETS[setName]
  if (!set) throw new Error(`unknown set ${setName}`)
  const limit = Number(arg('limit', '0')) || set.cases.length
  const cases = set.cases.slice(0, limit)
  // --no-self reads pastes without knowing who she is, as the app did before sign-in.
  const self = process.argv.includes('--no-self') ? undefined : set.self
  const ctxFor = (c: Case): ExtractContext => ({
    now: c.pastedAt,
    zone: c.zone,
    candidates: set.roster,
    self,
  })
  const rules = cases.map((c) => extractWithRules(c.paste, ctxFor(c)))
  const rows: Row[] = [summarize('rules', cases, rules, null, null, 0)]

  const key = process.env.OPENROUTER_API_KEY
  const models = arg('models', DEFAULT_MODELS.join(',')).split(',').filter(Boolean)
  if (!key) {
    process.stderr.write('OPENROUTER_API_KEY is not set, so only the rules were measured.\n')
  } else {
    for (const model of models) {
      // The same 12-second limit the app uses.
      const call: ModelCall = { model, apiKey: key, fetch, timeoutMs: 12_000 }
      const own: Proposal[] = []
      const merged: Proposal[] = []
      let ms = 0
      let cost = 0
      let errors = 0
      for (const [i, c] of cases.entries()) {
        const r = rules[i] as Proposal
        try {
          const out = await readWithModel(c.paste, ctxFor(c), call)
          const p = proposalFromReading(out.reading, c.paste, ctxFor(c))
          own.push(p)
          merged.push(mergeProposals(r, p))
          ms += out.usage.ms
          cost += out.usage.cost ?? 0
        } catch {
          // A failed call counts as wrong, so an unreliable model cannot look like the rules.
          errors++
          own.push(EMPTY)
          merged.push(EMPTY)
        }
      }
      rows.push(summarize(`${model}`, cases, own, ms / cases.length, cost, errors))
      rows.push(summarize(`rules + ${model}`, cases, merged, ms / cases.length, cost, errors))
    }
    if (process.argv.includes('--jev')) {
      const call: ModelCall = { model: JEV, apiKey: key, fetch, timeoutMs: 12_000 }
      const withJev: Proposal[] = []
      let ms = 0
      let cost = 0
      let errors = 0
      for (const [i, c] of cases.entries()) {
        const r = rules[i] as Proposal
        try {
          const out = await classifyWithJev(c.paste, ctxFor(c), call)
          const match = out.answers.matchId
            ? { id: out.answers.matchId, strength: 'strong' as const, via: 'jev' }
            : null
          withJev.push({
            ...r,
            direction: out.answers.direction,
            needsReply: out.answers.direction === 'in' && out.answers.needsReply >= 0.5,
            match,
          })
          ms += out.usage.ms
          cost += out.usage.cost ?? 0
        } catch {
          errors++
          withJev.push(EMPTY)
        }
      }
      rows.push(
        summarize(
          `rules + ${JEV} (direction, reply, match)`,
          cases,
          withJev,
          ms / cases.length,
          cost,
          errors,
        ),
      )
    }
  }

  const header = ['approach', ...FIELDS, 'ms/paste', 'cost', 'errors']
  const lines = [header.join(' | '), header.map(() => '---').join(' | ')]
  for (const r of rows) {
    lines.push(
      [
        r.approach,
        ...FIELDS.map((f) => r.fields[f]),
        r.ms === null ? '' : String(Math.round(r.ms)),
        r.cost === null ? '' : `$${r.cost.toFixed(4)}`,
        String(r.errors),
      ].join(' | '),
    )
  }
  const table = `${lines.join('\n')}\n`
  process.stdout.write(`set: ${setName}, ${cases.length} cases\n\n${table}`)
  const dir = resolve(import.meta.dirname, 'results')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${setName}.local.json`), JSON.stringify(rows, null, 2))
}

function summarize(
  approach: string,
  cases: Case[],
  proposals: Proposal[],
  ms: number | null,
  cost: number | null,
  errors: number,
): Row {
  const s = score(cases, proposals)
  const fields: Record<string, string> = {}
  for (const f of FIELDS) {
    fields[f] =
      `${Math.round(ratio(s.fields[f]) * 100)}% (${s.fields[f].correct}/${s.fields[f].checked})`
  }
  return { approach, fields, ms, cost, errors }
}

await main()
