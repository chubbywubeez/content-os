import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchInterviewDetail, interviewExportUrl } from '../services/interviewsClient'
import type { InterviewDetail } from '../types/interviews'

type Props = {
  stem: string | null
  onClose: () => void
}

type TabId = 'summary' | 'transcript' | 'quotes'

/**
 * Near full-screen profile: summary, transcript, quotes, MD download.
 */
export function InterviewDetailModal({ stem, onClose }: Props) {
  const titleId = useId()
  const [tab, setTab] = useState<TabId>('summary')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<InterviewDetail | null>(null)

  useEffect(() => {
    if (!stem) {
      setDetail(null)
      setError(null)
      setTab('summary')
      return
    }
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchInterviewDetail(stem)
        if (!cancelled) setDetail(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stem])

  useEffect(() => {
    if (!stem) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stem, onClose])

  if (!stem) return null

  const exportHref = interviewExportUrl(stem)

  return createPortal(
    <div className="cm-modal-root cm-modal-root--profile">
      <button type="button" className="cm-modal-backdrop" aria-label="Close profile" onClick={onClose} />
      <div
        className="cm-modal cm-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="cm-modal__head cm-profile-modal__head">
          <div>
            <p className="cm-profile-modal__eyebrow">
              {detail?.callType === 'demo'
                ? 'Demo'
                : detail?.persona
                  ? `${detail.persona.toUpperCase()} · ${detail.grade ?? '—'}`
                  : (detail?.grade ?? '—')}
            </p>
            <h2 id={titleId} className="cm-modal__title">
              {detail?.displayName ?? stem}
            </h2>
          </div>
          <div className="cm-profile-modal__actions">
            {detail ? (
              <a className="cm-btn cm-btn--ghost" href={exportHref} download>
                Download .md
              </a>
            ) : null}
            <button type="button" className="cm-modal__close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="cm-profile-modal__tabs" role="tablist">
          {(
            [
              ['summary', 'Summary'],
              ['transcript', 'Transcript'],
              ['quotes', 'Quotes'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`cm-profile-modal__tab ${tab === id ? 'cm-profile-modal__tab--active' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="cm-profile-modal__body">
          {loading ? <p className="cm-muted">Loading profile…</p> : null}
          {error ? <p className="cm-interviews-page__error">{error}</p> : null}
          {!loading && detail ? (
            <>
              {tab === 'summary' ? (
                <div className="cm-profile-panel">
                  <p className="cm-profile-summary">{detail.summary}</p>
                  {detail.classification ? (
                    <p className="cm-muted cm-profile-meta">
                      {detail.classification}
                      {detail.hypothesisPct ? ` · Hypothesis ${detail.hypothesisPct}` : ''}
                    </p>
                  ) : null}
                  {detail.meta?.rationale ? (
                    <div className="cm-profile-rationale">
                      <h3>Persona rationale</h3>
                      <p>{detail.meta.rationale}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {tab === 'transcript' ? (
                <div className="cm-profile-panel">
                  {detail.transcript?.markdown ? (
                    <pre className="cm-profile-pre">{detail.transcript.markdown}</pre>
                  ) : (
                    <p className="cm-muted">No transcript file found for this interview.</p>
                  )}
                </div>
              ) : null}
              {tab === 'quotes' ? (
                <div className="cm-profile-panel">
                  {detail.quotes?.snippets?.length ? (
                    <ul className="cm-profile-quotes">
                      {detail.quotes.snippets.map((s, i) => (
                        <li key={i} className="cm-profile-quote">
                          <blockquote>{s.pull_quote}</blockquote>
                          {s.theme_tag ? (
                            <p className="cm-muted cm-profile-quote__tag">{s.theme_tag}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="cm-muted">No mined quotes yet for this interview.</p>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
