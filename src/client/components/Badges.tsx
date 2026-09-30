import type { Flags } from '../../core/flags'
import { FLAG_LABELS, FLAGS, STAGE_LABELS, type Stage } from '../../core/types'
import { FLAG_TONE, STAGE_TONE } from '../lib/tones'

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="badge" data-tone={STAGE_TONE[stage] ?? undefined} data-stage={stage}>
      {STAGE_LABELS[stage]}
    </span>
  )
}

export function FlagBadges({ flags }: { flags: Flags }) {
  const on = FLAGS.filter((f) => flags[f])
  if (on.length === 0) return null
  return (
    <span className="badges">
      {on.map((f) => (
        <span key={f} className="badge" data-tone={FLAG_TONE[f]} data-flag={f}>
          {FLAG_LABELS[f]}
        </span>
      ))}
    </span>
  )
}
