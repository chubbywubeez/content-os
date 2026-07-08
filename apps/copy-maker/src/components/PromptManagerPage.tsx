import { useEffect, useMemo, useState } from 'react'
import {
  fetchPipelinePromptReference,
  fetchPipelinePrompts,
  savePipelinePromptReference,
  savePipelinePrompt,
} from '../services/pipelinePromptsClient'
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
  const [activePipelineId, setActivePipelineId] = useState<string>('all')
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const [previewBody, setPreviewBody] = useState('')
  const [previewDraft, setPreviewDraft] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewSaving, setPreviewSaving] = useState(false)
  const [previewDirty, setPreviewDirty] = useState(false)

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
        setActivePipelineId('all')
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

  const pipelineTabs = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of items) {
      if (!map.has(row.pipelineId)) map.set(row.pipelineId, row.pipelineTitle || row.pipelineId)
    }
    return [...map.entries()].map(([id, title]) => ({ id, title }))
  }, [items])

  const filteredItems = useMemo(() => {
    // "All prompts" should list only real editable prompts, not reference-only context steps.
    if (activePipelineId === 'all') {
      return items.filter((x) => x.editable)
    }
    return items.filter((x) => x.pipelineId === activePipelineId)
  }, [items, activePipelineId])

  const selected = useMemo(
    () => filteredItems.find((x) => x.key === selectedKey) ?? null,
    [filteredItems, selectedKey],
  )

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedKey('')
      setDraft('')
      setDirty(false)
      return
    }
    const stillVisible = filteredItems.some((x) => x.key === selectedKey)
    if (!stillVisible) {
      setSelectedKey(filteredItems[0]!.key)
      setDraft(filteredItems[0]!.content)
      setDirty(false)
    }
  }, [filteredItems, selectedKey])

  function choosePrompt(key: string) {
    const next = items.find((x) => x.key === key)
    setSelectedKey(key)
    setDraft(next?.content ?? '')
    setDirty(false)
    setError(null)
    setSaveNotice(null)
  }

  const previewableRefs = useMemo(
    () =>
      (selected?.references ?? []).filter(
        (ref) => ref.includes('/') && ref.includes('.') && !ref.toLowerCase().startsWith('ui '),
      ),
    [selected],
  )

  async function openReferencePreview(path: string) {
    setPreviewPath(path)
    setPreviewError(null)
    setPreviewBody('')
    setPreviewDraft('')
    setPreviewDirty(false)
    setPreviewLoading(true)
    try {
      const data = await fetchPipelinePromptReference(path)
      setPreviewBody(data.text)
      setPreviewDraft(data.text)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function saveReferencePreview() {
    if (!previewPath) return
    setPreviewSaving(true)
    setPreviewError(null)
    try {
      await savePipelinePromptReference(previewPath, previewDraft)
      setPreviewBody(previewDraft)
      setPreviewDirty(false)
      setSaveNotice(`Saved ${previewPath} at ${new Date().toLocaleTimeString()}.`)
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e))
    } finally {
      setPreviewSaving(false)
    }
  }

  const isMarkdownPreview = Boolean(previewPath && /\.md$/i.test(previewPath))

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
          <div className="cm-prompts-pipeline-tabs" role="tablist" aria-label="Pipeline tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activePipelineId === 'all'}
              className={`cm-prompts-pipeline-tab ${activePipelineId === 'all' ? 'cm-prompts-pipeline-tab--active' : ''}`}
              onClick={() => setActivePipelineId('all')}
            >
              All prompts
            </button>
            {pipelineTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activePipelineId === tab.id}
                className={`cm-prompts-pipeline-tab ${activePipelineId === tab.id ? 'cm-prompts-pipeline-tab--active' : ''}`}
                onClick={() => setActivePipelineId(tab.id)}
              >
                {tab.title}
              </button>
            ))}
          </div>
          <aside className="cm-prompts-list">
            {filteredItems.map((item, index) => {
              const active = item.key === selectedKey
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`cm-prompts-list__item ${active ? 'cm-prompts-list__item--active' : ''}`}
                  onClick={() => choosePrompt(item.key)}
                >
                  <span className="cm-prompts-list__step">
                    {index + 1}. {item.step}
                  </span>
                  <span className="cm-prompts-list__title">{item.title}</span>
                  {!item.editable ? (
                    <span className="cm-prompts-list__mode cm-prompts-list__mode--reference">Reference</span>
                  ) : null}
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
                    {!selected.editable ? (
                      <p className="cm-note cm-note--warn">
                        This step is reference-only. It is driven by source documents/inputs listed below.
                      </p>
                    ) : null}
                    {previewableRefs.length ? (
                      <div className="cm-prompts-editor__top-refs">
                        {previewableRefs.map((ref) => (
                          <button
                            key={ref}
                            type="button"
                            className="cm-prompts-editor__top-ref-btn"
                            onClick={() => void openReferencePreview(ref)}
                          >
                            {ref}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="cm-btn cm-btn--primary"
                    disabled={saving || !dirty || !selected.editable}
                    onClick={() => void onSave()}
                  >
                    {saving ? 'Saving…' : 'Save prompt'}
                  </button>
                </div>
                {selected.editable ? (
                  <textarea
                    className="cm-modal__textarea cm-prompts-editor__textarea"
                    value={draft}
                    readOnly={!selected.editable}
                    onChange={(e) => {
                      if (!selected.editable) return
                      setDraft(e.target.value)
                      setDirty(true)
                    }}
                  />
                ) : null}
              </>
            ) : (
              <p className="cm-muted">No prompts found.</p>
            )}
          </section>
        </div>
      )}

      {previewPath ? (
        <div className="cm-modal-root">
          <button
            type="button"
            className="cm-modal-backdrop"
            aria-label="Close reference preview"
            onClick={() => setPreviewPath(null)}
          />
          <div className="cm-modal cm-prompts-ref-modal" role="dialog" aria-modal="true">
            <header className="cm-modal__head">
              <h3 className="cm-modal__title">Reference preview: {previewPath}</h3>
              <div className="cm-prompts-ref-modal__head-actions">
                {isMarkdownPreview ? (
                  <button
                    type="button"
                    className="cm-btn cm-btn--primary cm-btn--small"
                    disabled={!previewDirty || previewSaving}
                    onClick={() => void saveReferencePreview()}
                  >
                    {previewSaving ? 'Saving…' : 'Save .md'}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cm-modal__close"
                  aria-label="Close"
                  onClick={() => setPreviewPath(null)}
                >
                  ×
                </button>
              </div>
            </header>
            <div className="cm-modal__body">
              {previewLoading ? <p className="cm-muted">Loading reference…</p> : null}
              {previewError ? <p className="cm-note cm-note--error">{previewError}</p> : null}
              {!previewLoading && !previewError ? (
                isMarkdownPreview ? (
                  <textarea
                    className="cm-modal__textarea cm-prompts-ref-modal__textarea"
                    value={previewDraft}
                    onChange={(e) => {
                      setPreviewDraft(e.target.value)
                      setPreviewDirty(true)
                    }}
                  />
                ) : (
                  <pre className="cm-prompts-ref-modal__pre">{previewBody}</pre>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
