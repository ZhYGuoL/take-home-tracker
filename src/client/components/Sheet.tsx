import { type ReactNode, useEffect, useRef } from 'react'

interface Props {
  label: string
  /** A drawer sits at the right on a wide screen. A dialog sits in the middle over a scrim. */
  variant: 'drawer' | 'dialog'
  onClose: () => void
  children: ReactNode
}

/** A panel over the page. Full screen on a phone. Escape closes it. */
export function Sheet({ label, variant, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el || el.contains(document.activeElement)) return
    const first = el.querySelector<HTMLElement>('[data-autofocus]')
    ;(first ?? el).focus()
  }, [])

  return (
    <>
      {variant === 'dialog' && <div className="scrim" aria-hidden="true" onClick={onClose} />}
      <div
        ref={ref}
        role="dialog"
        aria-modal={variant === 'dialog'}
        aria-label={label}
        tabIndex={-1}
        className={`sheet sheet-${variant} panel fade-in`}
      >
        {children}
      </div>
    </>
  )
}

export function SheetHeader({
  title,
  sub,
  onClose,
}: {
  title: ReactNode
  sub?: ReactNode
  onClose: () => void
}) {
  return (
    <div className="sheet-head">
      <div className="stack">
        <h2 className="sheet-title">{title}</h2>
        {sub && <span className="muted">{sub}</span>}
      </div>
      <button type="button" className="control icon" aria-label="Close" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  )
}
