import { formatDateTime } from './deadline'
import { derive } from './derive'
import { flagsOf } from './flags'
import { live, type StoredRecord } from './records'
import { FLAG_LABELS, FLAGS, SOURCE_LABELS, STAGE_LABELS } from './types'

export const VIEW_HEADER = [
  'Name',
  'Role',
  'Stage',
  'Flags',
  'Deadline',
  'Source',
  'Contact',
  'Submission',
  'Repo',
  'Take-home',
  'Last activity',
  'Notes',
]

/**
 * The readable `candidates` tab: one row per candidate, in plain words, newest activity first,
 * so she can open her Sheet and read it without the app (D3).
 */
export function viewRows(records: Iterable<StoredRecord>, now: number, zone: string): string[][] {
  const { candidates, entries } = live(records)
  const rows = candidates.map((c) => {
    const d = derive(c, entries)
    const f = flagsOf(c, d, now)
    return {
      at: Date.parse(d.lastActivityAt),
      cells: [
        c.name,
        c.role,
        STAGE_LABELS[d.stage],
        FLAGS.filter((x) => f[x])
          .map((x) => FLAG_LABELS[x])
          .join(', '),
        c.deadline ? formatDateTime(c.deadline.at, zone) : '',
        SOURCE_LABELS[c.source],
        c.contacts.join(', '),
        d.submission?.url ?? '',
        d.repo?.url ?? '',
        c.takeHomeUrl,
        formatDateTime(d.lastActivityAt, zone),
        c.notes,
      ],
    }
  })
  rows.sort((a, b) => b.at - a.at)
  return [VIEW_HEADER, ...rows.map((r) => r.cells)]
}
