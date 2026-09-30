import { formatDeadline, relative } from '../../core/deadline'
import { shortUrl } from '../../core/links'
import { SOURCE_LABELS } from '../../core/types'
import { useIsWide } from '../lib/media'
import type { Row } from '../store/context'
import { FlagBadges, StageBadge } from './Badges'

interface Props {
  rows: Row[]
  now: number
  zone: string
  selectedId: string | null
  onOpen: (id: string) => void
  onOpenSubmission: (row: Row) => void
}

export function CandidateTable(props: Props) {
  return useIsWide() ? <Table {...props} /> : <List {...props} />
}

function Deadline({ row, now, zone }: { row: Row; now: number; zone: string }) {
  const d = row.candidate.deadline
  if (!d) return <span className="muted">None</span>
  return (
    <span className="stack">
      <span className="num">{formatDeadline(d, zone)}</span>
      <span className="num muted">{relative(d.at, now)}</span>
    </span>
  )
}

function SubmissionLink({ row, onOpen }: { row: Row; onOpen: (row: Row) => void }) {
  const link = row.derived.submission ?? row.derived.repo
  if (!link) return <span className="muted">None</span>
  return (
    <a
      className="truncate"
      href={link.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(row)
      }}
    >
      {shortUrl(link.url)}
    </a>
  )
}

function Table({ rows, now, zone, selectedId, onOpen, onOpenSubmission }: Props) {
  return (
    <div className="table-scroll thin-scroll">
      <table className="table">
        <colgroup>
          <col />
          <col className="col-role" />
          <col className="col-stage" />
          <col className="col-flags" />
          <col className="col-deadline" />
          <col className="col-source" />
          <col className="col-activity" />
          <col className="col-link" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">NAME</th>
            <th scope="col">ROLE</th>
            <th scope="col">STAGE</th>
            <th scope="col">FLAGS</th>
            <th scope="col">DEADLINE</th>
            <th scope="col">SOURCE</th>
            <th scope="col">LAST ACTIVITY</th>
            <th scope="col">SUBMISSION</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const c = row.candidate
            return (
              <tr
                key={c.id}
                data-selected={c.id === selectedId || undefined}
                onClick={() => onOpen(c.id)}
              >
                <td>
                  <span className="stack">
                    {/* Its click bubbles to the row, which opens the candidate. */}
                    <button type="button" className="row-name">
                      {c.name}
                    </button>
                    {c.contacts[0] && <span className="num handle truncate">{c.contacts[0]}</span>}
                  </span>
                </td>
                <td className="truncate">{c.role || <span className="muted">None</span>}</td>
                <td>
                  <StageBadge stage={row.derived.stage} />
                </td>
                <td>
                  <FlagBadges flags={row.flags} />
                </td>
                <td>
                  <Deadline row={row} now={now} zone={zone} />
                </td>
                <td>{SOURCE_LABELS[c.source]}</td>
                <td className="num">{relative(row.derived.lastActivityAt, now)}</td>
                <td className="truncate">
                  <SubmissionLink row={row} onOpen={onOpenSubmission} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function List({ rows, now, onOpen }: Props) {
  return (
    <ul className="list" aria-label="Candidates">
      {rows.map((row) => {
        const c = row.candidate
        const d = c.deadline
        return (
          <li key={c.id} className="list-item">
            <button type="button" className="list-row" onClick={() => onOpen(c.id)}>
              <span className="list-line">
                <span className="row-name truncate">{c.name}</span>
                <StageBadge stage={row.derived.stage} />
              </span>
              <span className="list-line muted">
                <span className="truncate">
                  {[c.role, SOURCE_LABELS[c.source]].filter(Boolean).join(' · ')}
                </span>
                <span className="num">{d ? `due ${relative(d.at, now)}` : 'no deadline'}</span>
              </span>
              <FlagBadges flags={row.flags} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
