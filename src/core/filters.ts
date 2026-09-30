import { localParts } from './deadline'
import type { Derived } from './derive'
import type { Flags } from './flags'
import { type Candidate, FLAGS, type Flag, SOURCES, type Source, STAGES, type Stage } from './types'

export interface FactRow {
  candidate: Candidate
  derived: Derived
  flags: Flags
  needsYou: boolean
}

export type View = 'needs' | 'all'

export const DATE_FIELDS = ['deadline', 'submitted', 'sent', 'activity'] as const
export type DateField = (typeof DATE_FIELDS)[number]

export const DATE_FIELD_LABELS: Record<DateField, string> = {
  deadline: 'Deadline',
  submitted: 'Submitted',
  sent: 'Sent',
  activity: 'Last activity',
}

export interface DateRange {
  field: DateField
  /** Inclusive calendar dates (YYYY-MM-DD) in the viewer's zone. Null means open. */
  from: string | null
  to: string | null
}

export interface Filters {
  view: View
  stages: Stage[]
  flags: Flag[]
  /** Role names. The empty string stands for "no role". */
  roles: string[]
  sources: Source[]
  date: DateRange | null
  q: string
}

export const NO_FILTERS: Filters = {
  view: 'needs',
  stages: [],
  flags: [],
  roles: [],
  sources: [],
  date: null,
  q: '',
}

type Dimension = 'view' | 'stages' | 'flags' | 'roles' | 'sources' | 'date' | 'q'

function dateOf(row: FactRow, field: DateField): string | null {
  switch (field) {
    case 'deadline':
      return row.candidate.deadline?.at ?? null
    case 'submitted':
      return row.derived.submittedAt
    case 'sent':
      return row.candidate.sentAt
    case 'activity':
      return row.derived.lastActivityAt
  }
}

function inRange(row: FactRow, range: DateRange, zone: string): boolean {
  const iso = dateOf(row, range.field)
  if (!iso) return false
  const day = localParts(iso, zone).date
  return (range.from === null || day >= range.from) && (range.to === null || day <= range.to)
}

function searchable(row: FactRow): string {
  const c = row.candidate
  return [c.name, c.role, ...c.contacts].join(' ').toLowerCase()
}

/**
 * Dimensions combine with AND. Values inside one dimension combine with OR.
 * `skip` leaves one dimension out, which is how each option's count is computed.
 */
export function matches(row: FactRow, f: Filters, zone: string, skip?: Dimension): boolean {
  if (skip !== 'view' && f.view === 'needs' && !row.needsYou) return false
  if (skip !== 'stages' && f.stages.length > 0 && !f.stages.includes(row.derived.stage))
    return false
  if (skip !== 'flags' && f.flags.length > 0 && !f.flags.some((fl) => row.flags[fl])) return false
  if (skip !== 'roles' && f.roles.length > 0 && !f.roles.includes(row.candidate.role)) return false
  if (skip !== 'sources' && f.sources.length > 0 && !f.sources.includes(row.candidate.source)) {
    return false
  }
  if (skip !== 'date' && f.date && !inRange(row, f.date, zone)) return false
  if (skip !== 'q' && f.q.trim() !== '') {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    const text = searchable(row)
    if (!words.every((w) => text.includes(w))) return false
  }
  return true
}

export function applyFilters<R extends FactRow>(rows: readonly R[], f: Filters, zone: string): R[] {
  return rows.filter((r) => matches(r, f, zone))
}

export interface Counts {
  view: Record<View, number>
  stages: Record<Stage, number>
  flags: Record<Flag, number>
  roles: Array<[string, number]>
  sources: Record<Source, number>
}

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
}

/** For each option, how many rows it would show with every other filter kept. */
export function countOptions(rows: readonly FactRow[], f: Filters, zone: string): Counts {
  const counts: Counts = {
    view: { needs: 0, all: 0 },
    stages: zeroes(STAGES),
    flags: zeroes(FLAGS),
    roles: [],
    sources: zeroes(SOURCES),
  }
  const roles = new Map<string, number>()
  for (const r of rows) {
    if (matches(r, f, zone, 'view')) {
      counts.view.all++
      if (r.needsYou) counts.view.needs++
    }
    if (matches(r, f, zone, 'stages')) counts.stages[r.derived.stage]++
    if (matches(r, f, zone, 'flags')) {
      for (const fl of FLAGS) if (r.flags[fl]) counts.flags[fl]++
    }
    if (matches(r, f, zone, 'roles')) {
      roles.set(r.candidate.role, (roles.get(r.candidate.role) ?? 0) + 1)
    }
    if (matches(r, f, zone, 'sources')) counts.sources[r.candidate.source]++
  }
  for (const role of f.roles) if (!roles.has(role)) roles.set(role, 0)
  counts.roles = [...roles].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  return counts
}

export function activeCount(f: Filters): number {
  return (
    f.stages.length +
    f.flags.length +
    f.roles.length +
    f.sources.length +
    (f.date ? 1 : 0) +
    (f.q.trim() ? 1 : 0)
  )
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** "No role" is the empty string, which a query string cannot hold, so it travels as "~". */
const NO_ROLE = '~'

function listParam<T extends string>(p: URLSearchParams, key: string, allowed?: readonly T[]): T[] {
  const raw = p.get(key)
  if (!raw) return []
  const values = raw.split(',').map((v) => (v === NO_ROLE ? '' : decodeURIComponent(v))) as T[]
  return allowed ? values.filter((v) => allowed.includes(v)) : values
}

/** Reads filters from the query string. Unknown values are dropped. */
export function filtersFromQuery(p: URLSearchParams): Filters {
  let date: DateRange | null = null
  const rawDate = p.get('date')
  if (rawDate) {
    const [field, from, to] = rawDate.split(':')
    if ((DATE_FIELDS as readonly string[]).includes(field ?? '')) {
      date = {
        field: field as DateField,
        from: from && DAY.test(from) ? from : null,
        to: to && DAY.test(to) ? to : null,
      }
    }
  }
  return {
    view: p.get('view') === 'all' ? 'all' : 'needs',
    stages: listParam(p, 'stage', STAGES),
    flags: listParam(p, 'flag', FLAGS),
    roles: listParam(p, 'role'),
    sources: listParam(p, 'source', SOURCES),
    date,
    q: p.get('q') ?? '',
  }
}

/** The query parameters for `f`. A default value maps to null, which removes the parameter. */
export function filtersToQuery(f: Filters): Record<string, string | null> {
  const list = (v: readonly string[]) =>
    v.length ? v.map((x) => (x === '' ? NO_ROLE : encodeURIComponent(x))).join(',') : null
  return {
    view: f.view === 'all' ? 'all' : null,
    stage: list(f.stages),
    flag: list(f.flags),
    role: list(f.roles),
    source: list(f.sources),
    date: f.date ? `${f.date.field}:${f.date.from ?? ''}:${f.date.to ?? ''}` : null,
    q: f.q ? f.q : null,
  }
}
