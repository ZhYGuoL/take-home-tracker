import { STAGE_LABELS, type Stage } from '../../core/types'
import { STAGE_TONE } from '../lib/tones'

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="badge" data-tone={STAGE_TONE[stage] ?? undefined} data-stage={stage}>
      {STAGE_LABELS[stage]}
    </span>
  )
}
