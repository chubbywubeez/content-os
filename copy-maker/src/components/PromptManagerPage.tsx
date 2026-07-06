import { useEffect, useMemo, useState } from 'react'
import { fetchPipelinePrompts, savePipelinePrompt } from '../services/pipelinePromptsClient'
import type { PipelinePromptRecord } from '../types/pipelinePrompts'

/**
 * Prompt manager page:
 * - shows prompts in pipeline order
 * - allows editing one prompt at a time
 * - saves directly to database-backed API so pipeline uses latest content
 */
export function PromptManagerPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [items, setItems] = useState<PipelinePromptRecord[]>([])
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchPipelinePrompts()
        if (cancelled) return
        const sorted = [...data.prompts].sort((a, b) => a.order - b.order)
        setItems(sorted)
        setSelectedKey(sorted[0]?.key ?? '')
        setDraft(sorted[0]?.content ?? '')
        setWarning(data.warning)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(
    () => items.find((x) => x.key === selectedKey) ?? null,
    [items, selectedKey],
  )

  function choosePrompt(key: string) {
    const next = items.find((x) => x.key === key)
    setSelectedKey(key)
    setDraft(next?.content ?? '')
    setDirty(false)
    setError(null)
    setSaveNotice(null)
  }

  async function onSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    setSaveNotice(null)
    const beforeSave = draft
    try {
      const savedContent = await savePipelinePrompt(selected.key, beforeSave)
      setItems((prev) =>
        prev.map((row) =>
          row.key === selected.key
            ? { ...row, content: savedContent, source: 'database', updatedAt: new Date().toISOString() }
            : row,
        ),
      )
      setDraft(savedContent)
      setDirty(false)
      const changedByLock = savedContent.trim() !== beforeSave.trim()
      setSaveNotice(
        changedByLock
          ? `Saved to database. Protected output JSON was restored at ${new Date().toLocaleTimeString()}.`
          : `Saved to database at ${new Date().toLocaleTimeString()}.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cm-prompts-page">
      <header className="cm-interviews-page__head">
        <div>
          <p className="cm-interviews-page__eyebrow">Pipeline controls</p>
          <h1 className="cm-interviews-page__title">Prompt manager</h1>
          <p className="cm-interviews-page__sub">
            Edit prompts in pipeline order. Saves go to database and affect next pipeline run.
          </p>
        </div>
      </header>

      {warning ? <p className="cm-note cm-note--warn">{warning}</p> : null}
      {error ? <p className="cm-note cm-note--error">{error}</p> : null}
      {saveNotice ? <p className="cm-note">{saveNotice}</p> : null}

      {loading ? (
        <p className="cm-muted">Loading prompts…</p>
      ) : (
        <div className="cm-prompts-layout">
          <aside className="cm-prompts-list">
            {items.map((item) => {
              const active = item.key === selectedKey
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cm-prompts-list__item ${active ? 'cm-prompts-list__item--active' : ''}`}
                  onClick={() => choosePrompt(item.key)}
                >
                  <span className="cm-prompts-list__step">{item.order}. {item.step}</span>
                  <span className="cm-prompts-list__title">{item.title}</span>
                  <span className="cm-prompts-list__source">{item.source}</span>
                </button>
              )
            })}
          </aside>

          <section className="cm-prompts-editor">
            {selected ? (
              <>
                <div className="cm-prompts-editor__head">
                  <div>
                    <h2 className="cm-prompts-editor__title">{selected.title}</h2>
                    <p className="cm-prompts-editor__desc">{selected.description}</p>
                  </div>
                  <button
                    type="button"
                    className="cm-btn cm-btn--primary"
                    disabled={saving || !dirty}
                    onClick={() => void onSave()}
                  >
                    {saving ? 'Saving…' : 'Save prompt'}
                  </button>
                </div>
                <textarea
                  className="cm-modal__textarea cm-prompts-editor__textarea"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setDirty(true)
                  }}
                />
              </>
            ) : (
              <p className="cm-muted">No prompts found.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
