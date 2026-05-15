import { useMemo, useState } from 'react'
import type { OutlierCatalogEntry } from '../types/outlierCatalog'

const MAX_ROWS = 200

type Props = {
  entries: OutlierCatalogEntry[]
  loading: boolean
  errorMessage: string | null
  onRefresh: () => void
  /** Framework mode: rows without cache extraction are disabled. */
  requireFramework: boolean
  selectedUrn: string
  onSelect: (e: OutlierCatalogEntry) => void
  searchPlaceholder?: string
}

/**
 * Searchable outlier list + hover/selection preview of the full post body from the index.
 */
export function OutlierCatalogPicker({
  entries,
  loading,
  errorMessage,
  onRefresh,
  requireFramework,
  selectedUrn,
  onSelect,
  searchPlaceholder = 'Search by creator, hook, format, structural tags, axes…',
}: Props) {
  const [q, setQ] = useState('')
  const [hovered, setHovered] = useState<OutlierCatalogEntry | null>(null)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = !t ? entries : entries.filter((e) => e.searchText.includes(t))
    const total = list.length
    const rows = list.slice(0, MAX_ROWS)
    return { rows, total, capped: total > MAX_ROWS }
  }, [entries, q])

  const selected = entries.find((e) => e.urn === selectedUrn)
  const preview = hovered ?? selected ?? null

  return (
    <div className="cm-oc" onMouseLeave={() => setHovered(null)}>
      <div className="cm-oc__toolbar">
        <input
          type="search"
          className="cm-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search outliers"
        />
        <button type="button" className="cm-btn cm-btn--ghost cm-btn--small" disabled={loading} onClick={onRefresh}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
      </div>
      {errorMessage && <p className="cm-note cm-note--warn">{errorMessage}</p>}
      {filtered.capped && (
        <p className="cm-note">
          Showing first {MAX_ROWS} of {filtered.total} matches — refine search to narrow.
        </p>
      )}
      <div className="cm-oc__split">
        <div className="cm-oc__list" role="listbox" aria-label="Outlier posts">
          {filtered.rows.map((e) => {
            const disabled = requireFramework && !e.hasFramework
            const sel = e.urn === selectedUrn
            return (
              <button
                key={e.urn}
                type="button"
                role="option"
                aria-selected={sel}
                className={`cm-oc__row ${sel ? 'cm-oc__row--selected' : ''} ${disabled ? 'cm-oc__row--disabled' : ''}`.trim()}
                disabled={disabled}
                onMouseEnter={() => setHovered(e)}
                onClick={() => !disabled && onSelect(e)}
              >
                <div className="cm-oc__row-title">
                  <strong>{e.creator}</strong>
                  <span className="cm-oc__axes">{e.axes}</span>
                </div>
                <div className="cm-oc__hook">{e.hook || '—'}</div>
                <div className="cm-oc__tags">
                  {e.formatTags.slice(0, 2).map((t) => (
                    <span key={`f-${e.urn}-${t}`} className="cm-tag">
                      {t}
                    </span>
                  ))}
                  {e.structuralTags.slice(0, 2).map((t) => (
                    <span key={`s-${e.urn}-${t}`} className="cm-tag cm-tag--struct">
                      {t}
                    </span>
                  ))}
                  {requireFramework && (
                    <span className="cm-tag cm-tag--fw">{e.hasFramework ? 'FW ✓' : 'FW …'}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        <aside className="cm-oc__preview" aria-label="Post preview">
          {!preview ? (
            <p className="cm-muted">Hover or select a row to preview the full post.</p>
          ) : (
            <>
              <div className="cm-oc__preview-head">
                <span className="cm-oc__preview-creator">{preview.creator}</span>
                {preview.url ? (
                  <a className="cm-oc__link" href={preview.url} target="_blank" rel="noreferrer">
                    Open original ↗
                  </a>
                ) : null}
              </div>
              <pre className="cm-oc__preview-body">
                {preview.postBody || preview.textPreview || '(no text in index)'}
              </pre>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
