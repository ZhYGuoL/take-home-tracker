import type { Candidate, Entry, Link, Stage } from './types'

export interface Derived {
  stage: Stage
  /** The first inbound message that carried a submission or repo link. */
  submittedAt: string | null
  submission: Link | null
  repo: Link | null
  lastActivityAt: string
}

export function byTime(a: { at: string; id: string }, b: { at: string; id: string }): number {
  const d = Date.parse(a.at) - Date.parse(b.at)
  if (d !== 0) return d
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Moves `from` to `to` and leaves every other stage alone, so no rule can reach Advanced or Passed (D9). */
function autoAdvance(stage: Stage, from: Stage, to: Stage): Stage {
  return stage === from ? to : stage
}

export function derive(candidate: Candidate, entries: readonly Entry[]): Derived {
  const own = entries.filter((e) => e.candidateId === candidate.id).sort(byTime)
  let stage: Stage = 'sent'
  let submittedAt: string | null = null
  let submission: Link | null = null
  let repo: Link | null = null
  let lastActivityAt = candidate.createdAt

  for (const e of own) {
    if (Date.parse(e.at) > Date.parse(lastActivityAt)) lastActivityAt = e.at
    switch (e.kind) {
      case 'message': {
        if (e.direction !== 'in') break
        const sub = e.links.find((l) => l.kind === 'submission')
        const rep = e.links.find((l) => l.kind === 'repo')
        if (!sub && !rep) break
        if (sub) submission = sub
        if (rep) repo = rep
        submittedAt ??= e.at
        stage = autoAdvance(stage, 'sent', 'submitted')
        break
      }
      case 'opened':
        stage = autoAdvance(stage, 'submitted', 'reviewing')
        break
      case 'stage':
        stage = e.stage
        break
      case 'replied':
        break
    }
  }

  return { stage, submittedAt, submission, repo, lastActivityAt }
}
