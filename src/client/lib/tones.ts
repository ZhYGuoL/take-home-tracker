import type { Flag, Stage } from '../../core/types'

export type Tone = 'green' | 'gold' | 'blue' | 'orange' | 'pink' | 'purple'

/**
 * Each tone names one fact. Gold: a submission waits for her. Purple: she is reviewing.
 * Green: advanced. Sent and Passed stay ink, because neither asks anything of her.
 */
export const STAGE_TONE: Record<Stage, Tone | null> = {
  sent: null,
  submitted: 'gold',
  reviewing: 'purple',
  advanced: 'green',
  passed: null,
}

export const FLAG_TONE: Record<Flag, Tone> = {
  overdue: 'orange',
  late: 'pink',
  needsReply: 'blue',
}
