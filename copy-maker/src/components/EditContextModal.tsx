import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  title: string
  open: boolean
  initialText: string
  onClose: () => void
  /** Persist draft into workflow state. */
  onSave: (text: string) => void
}

/**
 * Full-screen dimmed overlay with a large textarea for editing loaded context
 * (voice, style guide, persona) without cluttering the main accordion.
 */
export function EditContextModal({ title, open, initialText, onClose, onSave }: Props) {
  const titleId = useId()
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(initialText)

  useEffect(() => {
    if (open) {
      setDraft(initialText)
      const t = window.setTimeout(() => taRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [open, initialText])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  function handleSave() {
    onSave(draft)
    onClose()
  }

  return createPortal(
    <div className="cm-modal-root">
      <button type="button" className="cm-modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="cm-modal__head">
          <h2 className="cm-modal__title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="cm-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="cm-modal__body">
          <label className="cm-sr-only" htmlFor="cm-context-modal-text">
            Content
          </label>
          <textarea
            id="cm-context-modal-text"
            ref={taRef}
            className="cm-modal__textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
        </div>
        <footer className="cm-modal__foot">
          <button type="button" className="cm-btn cm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="cm-btn cm-btn--primary" onClick={handleSave}>
            Save
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
