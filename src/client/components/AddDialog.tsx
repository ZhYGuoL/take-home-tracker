import { useState } from 'react'
import { type CandidateDraft, emptyDraft } from '../../core/draft'
import type { ExtractContext } from '../../core/extract/types'
import { CandidateForm } from './CandidateForm'
import { type Extractor, PasteFlow } from './PasteFlow'
import { Sheet, SheetHeader } from './Sheet'

interface Props {
  zone: string
  roles: string[]
  now: number
  extract: Extractor
  self: ExtractContext['self']
  onAddByHand: (draft: CandidateDraft) => void
  onSaved: (candidateId: string) => void
  onClose: () => void
}

/** Adds a candidate from a pasted message, or by hand. */
export function AddDialog({
  zone,
  roles,
  now,
  extract,
  self,
  onAddByHand,
  onSaved,
  onClose,
}: Props) {
  const [mode, setMode] = useState<'paste' | 'hand'>('paste')
  return (
    <Sheet label="Add candidate" variant="dialog" onClose={onClose}>
      <SheetHeader title="Add candidate" onClose={onClose} />
      <div className="sheet-switch">
        <div className="seg" role="radiogroup" aria-label="How to add">
          {(['paste', 'hand'] as const).map((m) => (
            // biome-ignore lint/a11y/useSemanticElements: a segmented control of buttons
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className="seg-item"
              onClick={() => setMode(m)}
            >
              {m === 'paste' ? 'Paste' : 'By hand'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'paste' ? (
        <PasteFlow
          zone={zone}
          roles={roles}
          extract={extract}
          self={self}
          onSaved={onSaved}
          onCancel={onClose}
        />
      ) : (
        <CandidateForm
          mode="add"
          initial={emptyDraft(zone, now)}
          zone={zone}
          roles={roles}
          submitLabel="Add"
          onSubmit={onAddByHand}
          onCancel={onClose}
        />
      )}
    </Sheet>
  )
}
