import { useEffect, useState } from 'react'
import { fetchDemosList } from '../services/interviewsClient'
import type { InterviewListItem } from '../types/interviews'
import { InterviewDetailModal } from './InterviewDetailModal'

type Props = {
  onOpenTranscriptImport?: () => void
}

/**
 * Product demo library — flat grid, grade or "Demo" on each card.
 */
export function DemosPage({ onOpenTranscriptImport }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<InterviewListItem[]>([])
  const [selectedStem, setSelectedStem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchDemosList()
        if (!cancelled) setItems(data.demos)
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

  return (
    <div className="cm-interviews-page cm-demos-page">
      <header className="cm-interviews-page__head">
        <div>
          <p className="cm-interviews-page__eyebrow">Research library</p>
          <h1 className="cm-interviews-page__title">Product demos</h1>
          <p className="cm-interviews-page__sub">
            {loading ? 'Loading…' : `${items.length} demo calls`}
          </p>
        </div>
        {onOpenTranscriptImport ? (
          <button type="button" className="cm-btn cm-btn--primary" onClick={onOpenTranscriptImport}>
            Import transcript
          </button>
        ) : null}
      </header>

      {error ? <p className="cm-interviews-page__error">{error}</p> : null}

      {loading ? (
        <p className="cm-muted">Loading demos…</p>
      ) : items.length === 0 ? (
        <p className="cm-muted">
          No demos yet. Import a 3-person product demo transcript — the pipeline will classify it and
          route it here.
        </p>
      ) : (
        <ul className="cm-interviews-grid cm-demos-grid">
          {items.map((row) => (
            <li key={row.stem}>
              <button
                type="button"
                className="cm-interview-card cm-interview-card--demo"
                onClick={() => setSelectedStem(row.stem)}
              >
                <span className="cm-interview-card__name">{row.displayName}</span>
                <span className="cm-interview-card__grade">{row.grade}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <InterviewDetailModal stem={selectedStem} onClose={() => setSelectedStem(null)} />
    </div>
  )
}
