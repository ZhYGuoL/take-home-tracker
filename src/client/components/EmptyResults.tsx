import {
  activeCount,
  applyFilters,
  type FactRow,
  type Filters,
  NO_FILTERS,
} from '../../core/filters'
import { FLAG_LABELS, SOURCE_LABELS, STAGE_LABELS } from '../../core/types'

interface Props {
  rows: FactRow[]
  filters: Filters
  zone: string
  onChange: (f: Filters) => void
}

/** Names the empty state, then offers each loosening with the rows it would bring back. */
export function EmptyResults({ rows, filters, zone, onChange }: Props) {
  const count = (f: Filters) => applyFilters(rows, f, zone).length
  const hatches: Array<{ label: string; next: Filters }> = []
  const names = (values: string[], labels: Record<string, string>) =>
    values.map((v) => labels[v] ?? (v || 'No role')).join(', ')

  if (filters.stages.length)
    hatches.push({
      label: `Any stage, not ${names(filters.stages, STAGE_LABELS)}`,
      next: { ...filters, stages: [] },
    })
  if (filters.flags.length)
    hatches.push({
      label: `Any flag, not ${names(filters.flags, FLAG_LABELS)}`,
      next: { ...filters, flags: [] },
    })
  if (filters.roles.length)
    hatches.push({
      label: `Any role, not ${names(filters.roles, {})}`,
      next: { ...filters, roles: [] },
    })
  if (filters.sources.length)
    hatches.push({
      label: `Any source, not ${names(filters.sources, SOURCE_LABELS)}`,
      next: { ...filters, sources: [] },
    })
  if (filters.date) hatches.push({ label: 'Any date', next: { ...filters, date: null } })
  if (filters.q.trim())
    hatches.push({ label: `Any text, not "${filters.q.trim()}"`, next: { ...filters, q: '' } })
  if (filters.view === 'needs')
    hatches.push({ label: 'Any view, not Needs you', next: { ...filters, view: 'all' } })
  if (activeCount(filters) > 1 || (activeCount(filters) === 1 && filters.view === 'needs'))
    hatches.push({ label: 'Clear every filter', next: { ...NO_FILTERS, view: 'all' } })

  const title =
    filters.view === 'needs' && activeCount(filters) === 0
      ? 'Nothing needs you'
      : 'No candidates match'

  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      <ul className="hatches">
        {hatches
          .map((h) => ({ ...h, n: count(h.next) }))
          .filter((h) => h.n > 0)
          .map((h) => (
            <li key={h.label}>
              <button type="button" className="control hatch" onClick={() => onChange(h.next)}>
                <span>{h.label}</span>
                <span className="num option-count">{h.n}</span>
              </button>
            </li>
          ))}
      </ul>
    </div>
  )
}
