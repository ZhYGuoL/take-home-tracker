import type { Candidate, Entry, Link, Stage } from './types'

export interface Derived {
  stage: Stage
  /**
   * When the work came in: the first inbound message with a submission or repo link, or the
   * first time she set Submitted or Reviewing by hand, such as for a zip sent by email.
   */
  submittedAt: string | null
  submission: Link | null
  repo: Link | null
  lastActivityAt: string
  /**
   * When the message that waits on her came in: the latest message is inbound and needs a
   * reply, and no reply mark or outbound message comes after it (D7). Null when nothing waits.
   */
  waitingSince: string | null
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
  // What happened last: the take-home going out, or anything on the timeline. When she added
  // the candidate counts only when nothing else is known.
  let lastActivityAt: string | null = candidate.sentAt
  let waitingSince: string | null = null

  for (const e of own) {
    if (lastActivityAt === null || Date.parse(e.at) > Date.parse(lastActivityAt))
      lastActivityAt = e.at
    switch (e.kind) {
      case 'message': {
        waitingSince = e.direction === 'in' && e.needsReply ? e.at : null
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
        if (stage === 'submitted' || stage === 'reviewing') submittedAt ??= e.at
        break
      case 'replied':
        waitingSince = null
        break
    }
  }

  return {
    stage,
    submittedAt,
    submission,
    repo,
    lastActivityAt: lastActivityAt ?? candidate.createdAt,
    waitingSince,
  }
}
