import { type ReactNode, useEffect, useRef, useState } from 'react'
import { localParts } from '../../core/deadline'
import {
  activeCount,
  type Counts,
  DATE_FIELD_LABELS,
  DATE_FIELDS,
  type DateField,
  type DateRange,
  type Filters,
} from '../../core/filters'
import {
  FLAG_LABELS,
  FLAGS,
  type Flag,
  SOURCE_LABELS,
  SOURCES,
  STAGE_LABELS,
  STAGES,
} from '../../core/types'
import { FLAG_TONE, STAGE_TONE, type Tone } from '../lib/tones'

interface Props {
  filters: Filters
  counts: Counts
  zone: string
  now: number
  onChange: (f: Filters) => void
}

type Open = 'stage' | 'flag' | 'role' | 'source' | 'date' | null

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FilterBar({ filters, counts, zone, now, onChange }: Props) {
  const [open, setOpen] = useState<Open>(null)
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  const flip = (which: Exclude<Open, null>) => setOpen((o) => (o === which ? null : which))
  const close = () => setOpen(null)

  return (
    <div className="toolbar">
      <div className="seg view-switch" role="radiogroup" aria-label="View">
        {(['needs', 'all'] as const).map((v) => (
          // biome-ignore lint/a11y/useSemanticElements: a segmented control of buttons
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={filters.view === v}
            className="seg-item"
            onClick={() => set({ view: v })}
          >
            {v === 'needs' ? 'Needs you' : 'All'}
            <span className="num seg-count">{counts.view[v]}</span>
          </button>
        ))}
      </div>

      <label className="card search">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <span className="visually-hidden">Search</span>
        <input
          className="search-input"
          type="search"
          value={filters.q}
          placeholder="Name, role, email, handle"
          onChange={(e) => set({ q: e.target.value })}
        />
      </label>

      <div className="chips">
        {activeCount(filters) > 0 && (
          <button
            type="button"
            className="control"
            onClick={() =>
              onChange({
                ...filters,
                stages: [],
                flags: [],
                roles: [],
                sources: [],
                date: null,
                q: '',
              })
            }
          >
            Clear <span className="num">{activeCount(filters)}</span>
          </button>
        )}
        <Chip
          label="Stage"
          selected={filters.stages.length}
          tone={filters.stages.length === 1 ? STAGE_TONE[filters.stages[0] ?? 'sent'] : null}
          open={open === 'stage'}
          onToggle={() => flip('stage')}
          onClose={close}
        >
          <Options
            title="STAGE"
            options={STAGES.map((s) => ({
              value: s,
              label: STAGE_LABELS[s],
              count: counts.stages[s],
              checked: filters.stages.includes(s),
            }))}
            onToggle={(s) => set({ stages: toggle(filters.stages, s) })}
          />
        </Chip>
        <Chip
          label="Flag"
          selected={filters.flags.length}
          tone={filters.flags.length === 1 ? FLAG_TONE[filters.flags[0] as Flag] : null}
          open={open === 'flag'}
          onToggle={() => flip('flag')}
          onClose={close}
        >
          <Options
            title="FLAG"
            options={FLAGS.map((f) => ({
              value: f,
              label: FLAG_LABELS[f],
              count: counts.flags[f],
              checked: filters.flags.includes(f),
            }))}
            onToggle={(f) => set({ flags: toggle(filters.flags, f) })}
          />
        </Chip>
        <Chip
          label="Role"
          selected={filters.roles.length}
          open={open === 'role'}
          onToggle={() => flip('role')}
          onClose={close}
        >
          <Options
            title="ROLE"
            options={counts.roles.map(([role, count]) => ({
              value: role,
              label: role || 'No role',
              count,
              checked: filters.roles.includes(role),
            }))}
            onToggle={(r) => set({ roles: toggle(filters.roles, r) })}
          />
        </Chip>
        <Chip
          label="Source"
          selected={filters.sources.length}
          open={open === 'source'}
          onToggle={() => flip('source')}
          onClose={close}
        >
          <Options
            title="SOURCE"
            options={SOURCES.map((s) => ({
              value: s,
              label: SOURCE_LABELS[s],
              count: counts.sources[s],
              checked: filters.sources.includes(s),
            }))}
            onToggle={(s) => set({ sources: toggle(filters.sources, s) })}
          />
        </Chip>
        <Chip
          label="Date"
          selected={filters.date ? 1 : 0}
          open={open === 'date'}
          onToggle={() => flip('date')}
          onClose={close}
        >
          <DateOptions
            range={filters.date}
            zone={zone}
            now={now}
            onChange={(date) => set({ date })}
          />
        </Chip>
      </div>
    </div>
  )
}

function Chip({
  label,
  selected,
  tone = null,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string
  selected: number
  tone?: Tone | null
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    // A tap on the phone scrim closes through the scrim's own click, so the tap never
    // reaches the row under it.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element
      if (ref.current?.contains(target) || target.closest?.('.popover-scrim')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onClose()
      button.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  // Tab out of the popover closes it. Safari gives no new focus target when a tap lands on a
  // checkbox, so only a real move to another element outside counts.
  useEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const onOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null
      if (next && !el.contains(next)) onClose()
    }
    el.addEventListener('focusout', onOut)
    return () => el.removeEventListener('focusout', onOut)
  }, [open, onClose])

  return (
    <div className="chip-wrap" ref={ref}>
      <button
        ref={button}
        type="button"
        className="control chip"
        aria-expanded={open}
        data-active={selected > 0 || undefined}
        data-tone={selected > 0 && tone ? tone : undefined}
        onClick={onToggle}
      >
        {label}
        {selected > 0 && <span className="num">{selected}</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      {open && (
        <>
          <div className="popover-scrim" aria-hidden="true" onClick={onClose} />
          <div className="popover fade-in">{children}</div>
        </>
      )}
    </div>
  )
}

function Options<T extends string>({
  title,
  options,
  onToggle,
}: {
  title: string
  options: Array<{ value: T; label: string; count: number; checked: boolean }>
  onToggle: (v: T) => void
}) {
  return (
    <fieldset className="options">
      <legend className="section-label">{title}</legend>
      {options.map((o) => (
        <label key={o.value || '(none)'} className="option">
          <input
            className="option-check"
            type="checkbox"
            checked={o.checked}
            onChange={() => onToggle(o.value)}
          />
          <span className="option-label">{o.label}</span>{' '}
          <span className="num option-count">{o.count}</span>
        </label>
      ))}
    </fieldset>
  )
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

function DateOptions({
  range,
  zone,
  now,
  onChange,
}: {
  range: DateRange | null
  zone: string
  now: number
  onChange: (r: DateRange | null) => void
}) {
  const today = localParts(new Date(now).toISOString(), zone).date
  // The field alone filters nothing, so it only becomes a filter together with a range.
  const [picked, setPicked] = useState<DateField>(range?.field ?? 'deadline')
  const field = range?.field ?? picked
  const presets: Array<[string, string | null, string | null]> = [
    ['Today', today, today],
    ['Next 7 days', today, addDays(today, 6)],
    ['Past 7 days', addDays(today, -6), today],
    ['Past 30 days', addDays(today, -29), today],
  ]
  const setRange = (from: string | null, to: string | null) =>
    onChange(from || to ? { field, from, to } : null)
  const setField = (f: DateField) => {
    setPicked(f)
    if (range) onChange({ ...range, field: f })
  }
  return (
    <div className="options">
      <span className="section-label">DATE</span>
      <label className="field">
        <span className="field-label">Field</span>
        <select value={field} onChange={(e) => setField(e.target.value as DateField)}>
          {DATE_FIELDS.map((f) => (
            <option key={f} value={f}>
              {DATE_FIELD_LABELS[f]}
            </option>
          ))}
        </select>
      </label>
      <div className="presets">
        {presets.map(([label, from, to]) => (
          <button
            key={label}
            type="button"
            className="control small"
            aria-pressed={range?.from === from && range?.to === to}
            onClick={() => setRange(from, to)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="field-row">
        <label className="field">
          <span className="field-label">From</span>
          <input
            type="date"
            value={range?.from ?? ''}
            onChange={(e) => setRange(e.target.value || null, range?.to ?? null)}
          />
        </label>
        <label className="field">
          <span className="field-label">To</span>
          <input
            type="date"
            value={range?.to ?? ''}
            onChange={(e) => setRange(range?.from ?? null, e.target.value || null)}
          />
        </label>
      </div>
      {range && (
        <button type="button" className="control small" onClick={() => onChange(null)}>
          Any date
        </button>
      )}
    </div>
  )
}
