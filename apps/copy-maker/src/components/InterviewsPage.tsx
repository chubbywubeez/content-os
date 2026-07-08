import { useEffect, useState } from 'react'
import { fetchInterviewsList } from '../services/interviewsClient'
import type { InterviewListItem, PersonaId } from '../types/interviews'
import { InterviewDetailModal } from './InterviewDetailModal'

const PERSONA_ORDER: PersonaId[] = ['bofu', 'mofu', 'tofu']
const PERSONA_LABEL: Record<PersonaId, string> = {
  bofu: 'BOFU',
  mofu: 'MOFU',
  tofu: 'TOFU',
}

type Props = {
  onOpenTranscriptImport?: () => void
}

/**
 * Customer interviews directory — cards grouped by funnel persona, grade only on surface.
 */
export function InterviewsPage({ onOpenTranscriptImport }: Props) {
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
        const data = await fetchInterviewsList()
        if (!cancelled) setItems(data.interviews)
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

  const grouped = PERSONA_ORDER.map((persona) => ({
    persona,
    label: PERSONA_LABEL[persona],
    rows: items.filter((i) => i.persona === persona),
  }))

  return (
    <div className="cm-interviews-page">
      <header className="cm-interviews-page__head">
        <div>
          <p className="cm-interviews-page__eyebrow">Research library</p>
          <h1 className="cm-interviews-page__title">Customer interviews</h1>
          <p className="cm-interviews-page__sub">
            {loading ? 'Loading…' : `${items.length} graded interviews`}
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
        <p className="cm-muted">Loading interviews…</p>
      ) : (
        <div className="cm-interviews-sections">
          {grouped.map((section) => (
            <section key={section.persona} className="cm-interviews-section">
              <h2 className={`cm-interviews-section__title cm-interviews-section__title--${section.persona}`}>
                {section.label}
                <span className="cm-interviews-section__count">{section.rows.length}</span>
              </h2>
              {section.rows.length === 0 ? (
                <p className="cm-muted cm-interviews-section__empty">No interviews in this bucket yet.</p>
              ) : (
                <ul className="cm-interviews-grid">
                  {section.rows.map((row) => (
                    <li key={row.stem}>
                      <button
                        type="button"
                        className="cm-interview-card"
                        onClick={() => setSelectedStem(row.stem)}
                      >
                        <span className="cm-interview-card__name">{row.displayName}</span>
                        <span className="cm-interview-card__grade">{row.grade}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <InterviewDetailModal stem={selectedStem} onClose={() => setSelectedStem(null)} />
    </div>
  )
}
