import { type FormEvent, type ReactNode, useId, useMemo, useState } from 'react'
import {
  deadlineAfterDays,
  deadlineAfterHours,
  deadlineAt,
  formatDateTime,
  instantIn,
  localParts,
  zoneName,
} from '../../core/deadline'
import { type CandidateDraft, type DraftErrors, validateDraft } from '../../core/draft'
import { SOURCE_LABELS, SOURCES, type Source } from '../../core/types'

interface Props {
  initial: CandidateDraft
  /** Adding shows the submission fields. Editing a saved candidate does not. */
  mode: 'add' | 'edit'
  zone: string
  roles: string[]
  submitLabel: string
  onSubmit: (draft: CandidateDraft) => void
  onCancel: () => void
  /** Extra fields above the form, such as the candidate an added message attaches to. */
  before?: ReactNode
}

const COMMON_ZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

function zoneOptions(own: string, current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone')
  const first = [...new Set([own, current, ...COMMON_ZONES])]
  return [...first, ...all.filter((z) => !first.includes(z))]
}

const PRESETS: Array<{ label: string; apply: (from: string, zone: string) => string }> = [
  { label: '24h', apply: (from, zone) => deadlineAfterHours(from, 24, zone).at },
  { label: '48h', apply: (from, zone) => deadlineAfterHours(from, 48, zone).at },
  { label: '72h', apply: (from, zone) => deadlineAfterHours(from, 72, zone).at },
  { label: '7d', apply: (from, zone) => deadlineAfterDays(from, 7, zone).at },
]

export function CandidateForm({
  initial,
  mode,
  zone,
  roles,
  submitLabel,
  onSubmit,
  onCancel,
  before,
}: Props) {
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const zones = useMemo(() => zoneOptions(zone, initial.dueZone), [zone, initial.dueZone])
  const rolesId = useId()
  const now = useMemo(() => new Date().toISOString(), [])

  const set = <K extends keyof CandidateDraft>(key: K, value: CandidateDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const applyPreset = (apply: (from: string, zone: string) => string) => {
    const from = draft.sentDate ? instantIn(draft.sentDate, draft.sentTime || '12:00', zone) : now
    const due = localParts(apply(from, draft.dueZone), draft.dueZone)
    setDraft((d) => ({ ...d, dueDate: due.date, dueTime: due.time }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(draft)
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-body thin-scroll">
        {before}
        <fieldset>
          <legend>CANDIDATE</legend>
          <Field label="Name" error={errors.name}>
            <input
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              autoComplete="off"
              data-autofocus
            />
          </Field>
          <Field label="Role">
            <input
              value={draft.role}
              onChange={(e) => set('role', e.target.value)}
              list={rolesId}
              autoComplete="off"
            />
            <datalist id={rolesId}>
              {roles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="Source">
            <select value={draft.source} onChange={(e) => set('source', e.target.value as Source)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact">
            <input
              value={draft.contacts}
              placeholder="Email, handle, or phone"
              onChange={(e) => set('contacts', e.target.value)}
              autoComplete="off"
            />
          </Field>
        </fieldset>

        <fieldset>
          <legend>TAKE-HOME</legend>
          <Field label="Take-home link" error={errors.takeHomeUrl}>
            <input
              value={draft.takeHomeUrl}
              onChange={(e) => set('takeHomeUrl', e.target.value)}
              inputMode="url"
              autoComplete="off"
            />
          </Field>
          <div className="field-row">
            <Field label="Sent" error={errors.sentDate}>
              <input
                type="date"
                value={draft.sentDate}
                onChange={(e) => set('sentDate', e.target.value)}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={draft.sentTime}
                onChange={(e) => set('sentTime', e.target.value)}
              />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Deadline" error={errors.dueDate}>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
              />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={draft.dueTime}
                onChange={(e) => set('dueTime', e.target.value)}
              />
            </Field>
          </div>
          <fieldset className="presets">
            <legend className="visually-hidden">Deadline after sent</legend>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="control small"
                onClick={() => applyPreset(p.apply)}
              >
                <span className="num">{p.label}</span>
              </button>
            ))}
          </fieldset>
          <DeadlineReadout draft={draft} zone={zone} />
          <Field label="Deadline zone">
            <select value={draft.dueZone} onChange={(e) => set('dueZone', e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replaceAll('_', ' ')} · {zoneName(now, z)}
                </option>
              ))}
            </select>
          </Field>
        </fieldset>

        {mode === 'add' && (
          <fieldset>
            <legend>SUBMISSION</legend>
            <Field label="Submission link" error={errors.submissionUrl}>
              <input
                value={draft.submissionUrl}
                onChange={(e) => set('submissionUrl', e.target.value)}
                inputMode="url"
                autoComplete="off"
              />
            </Field>
            <Field label="Repo link" error={errors.repoUrl}>
              <input
                value={draft.repoUrl}
                onChange={(e) => set('repoUrl', e.target.value)}
                inputMode="url"
                autoComplete="off"
              />
            </Field>
            <div className="field-row">
              <Field label="Submitted" error={errors.submittedDate}>
                <input
                  type="date"
                  value={draft.submittedDate}
                  onChange={(e) => set('submittedDate', e.target.value)}
                />
              </Field>
              <Field label="Time" error={errors.submittedTime}>
                <input
                  type="time"
                  value={draft.submittedTime}
                  onChange={(e) => set('submittedTime', e.target.value)}
                />
              </Field>
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>NOTES</legend>
          <Field label="Notes">
            <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </fieldset>
      </div>
      <div className="form-actions">
        <button type="button" className="control" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="control primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

/** The deadline the fields describe, in her own zone. */
function DeadlineReadout({ draft, zone }: { draft: CandidateDraft; zone: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) return null
  const d = deadlineAt(draft.dueDate, draft.dueTime || null, draft.dueZone)
  return (
    <output className="readout num" aria-label="Deadline in your time zone">
      {formatDateTime(d.at, zone)} {zoneName(d.at, zone)}
    </output>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | undefined
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child
    <label className="field" data-invalid={error ? true : undefined}>
      <span className="field-label">
        {label}
        {error && <span className="field-error">{error}</span>}
      </span>
      {children}
    </label>
  )
}
