import { useMemo, useState } from 'react'
import type { OutlierCatalogEntry } from '../types/outlierCatalog'

const MAX_ROWS = 200
const TOP_TAG_COUNT = 12

type LengthBucket = 'short' | 'medium' | 'long' | 'mega'

const LENGTH_BUCKETS: { id: LengthBucket; label: string; min: number; max: number }[] = [
  { id: 'short', label: 'Short (<80w)', min: 0, max: 80 },
  { id: 'medium', label: 'Medium (80–200w)', min: 80, max: 200 },
  { id: 'long', label: 'Long (200–400w)', min: 200, max: 400 },
  { id: 'mega', label: 'Mega (400+w)', min: 400, max: Infinity },
]

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function bucketFor(words: number): LengthBucket {
  for (const b of LENGTH_BUCKETS) if (words >= b.min && words < b.max) return b.id
  return 'mega'
}

type Props = {
  entries: OutlierCatalogEntry[]
  loading: boolean
  errorMessage: string | null
  onRefresh: () => void
  /** Framework mode: rows without a usable template are disabled. */
  requireFramework: boolean
  /** `swipe` = cleaned markdown catalog; `legacy` = index + architecture cache. */
  catalogSource?: 'swipe' | 'legacy'
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
  catalogSource,
  selectedUrn,
  onSelect,
  searchPlaceholder = 'Search by creator, hook, framework name, tags, format…',
}: Props) {
  const [q, setQ] = useState('')
  const [hovered, setHovered] = useState<OutlierCatalogEntry | null>(null)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [activeLength, setActiveLength] = useState<LengthBucket | null>(null)

  // Word count + bucket per entry, plus top suggested tags by frequency.
  const enriched = useMemo(() => {
    return entries.map((e) => {
      const words = wordCount(e.postBody || e.textPreview || '')
      return { e, words, bucket: bucketFor(words) }
    })
  }, [entries])

  const lengthCounts = useMemo(() => {
    const m: Record<LengthBucket, number> = { short: 0, medium: 0, long: 0, mega: 0 }
    for (const row of enriched) m[row.bucket] += 1
    return m
  }, [enriched])

  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of enriched) {
      const all = [...row.e.formatTags, ...row.e.structuralTags]
      for (const t of all) {
        if (!t) continue
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_TAG_COUNT)
      .map(([tag, count]) => ({ tag, count }))
  }, [enriched])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = enriched.filter((row) => {
      if (t && !row.e.searchText.includes(t)) return false
      if (activeLength && row.bucket !== activeLength) return false
      if (activeTags.size > 0) {
        const tagSet = new Set([...row.e.formatTags, ...row.e.structuralTags])
        for (const need of activeTags) if (!tagSet.has(need)) return false
      }
      return true
    })
    const total = list.length
    const rows = list.slice(0, MAX_ROWS)
    return { rows, total, capped: total > MAX_ROWS }
  }, [enriched, q, activeLength, activeTags])

  const selected = entries.find((e) => e.urn === selectedUrn)
  const preview = hovered ?? selected ?? null

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })

  const clearAll = () => {
    setActiveTags(new Set())
    setActiveLength(null)
    setQ('')
  }

  const filtersActive = activeTags.size > 0 || activeLength !== null || q.trim().length > 0

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

      <div className="cm-oc__filters" aria-label="Filter chips">
        <div className="cm-oc__chip-row">
          <span className="cm-oc__chip-label">Length</span>
          {LENGTH_BUCKETS.map((b) => {
            const on = activeLength === b.id
            const count = lengthCounts[b.id]
            return (
              <button
                key={b.id}
                type="button"
                className={`cm-chip cm-chip--length ${on ? 'cm-chip--on' : ''}`.trim()}
                onClick={() => setActiveLength(on ? null : b.id)}
                aria-pressed={on}
                title={`${count} posts`}
              >
                {b.label} <span className="cm-chip__count">{count}</span>
              </button>
            )
          })}
        </div>
        {topTags.length > 0 && (
          <div className="cm-oc__chip-row">
            <span className="cm-oc__chip-label">Tags</span>
            {topTags.map(({ tag, count }) => {
              const on = activeTags.has(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  className={`cm-chip ${on ? 'cm-chip--on' : ''}`.trim()}
                  onClick={() => toggleTag(tag)}
                  aria-pressed={on}
                  title={`${count} posts`}
                >
                  {tag} <span className="cm-chip__count">{count}</span>
                </button>
              )
            })}
            {filtersActive && (
              <button type="button" className="cm-chip cm-chip--clear" onClick={clearAll}>
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {errorMessage && <p className="cm-note cm-note--warn">{errorMessage}</p>}
      {catalogSource === 'swipe' && (
        <p className="cm-note">
          Swipe-file catalog — named frameworks + bracketed templates from cleaned outlier posts.
        </p>
      )}
      {catalogSource === 'legacy' && (
        <p className="cm-note cm-note--warn">
          Legacy catalog (index + architecture cache). Run{' '}
          <code className="cm-inline-code">npm run swipe:catalog</code> in <code className="cm-inline-code">copy-maker</code>{' '}
          after generating <code className="cm-inline-code">*_cleaned.md</code> files.
        </p>
      )}
      {filtered.capped ? (
        <p className="cm-note">
          Showing first {MAX_ROWS} of {filtered.total} matches — refine search or chips to narrow.
        </p>
      ) : (
        <p className="cm-note">{filtered.total} match{filtered.total === 1 ? '' : 'es'}.</p>
      )}
      <div className="cm-oc__split">
        <div className="cm-oc__list" role="listbox" aria-label="Outlier posts">
          {filtered.rows.map(({ e, words, bucket }) => {
            const disabled = requireFramework && !e.hasFramework
            const sel = e.urn === selectedUrn
            const bucketLabel = LENGTH_BUCKETS.find((b) => b.id === bucket)?.label ?? ''
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
                {e.frameworkName && e.frameworkName !== 'Unnamed framework' ? (
                  <div className="cm-oc__fw-name">{e.frameworkName}</div>
                ) : null}
                <div className="cm-oc__tags">
                  <span className="cm-tag cm-tag--len" title={bucketLabel}>
                    {words}w
                  </span>
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
          {filtered.rows.length === 0 && (
            <p className="cm-muted" style={{ padding: '12px' }}>
              No posts match these filters. Try clearing chips or the search.
            </p>
          )}
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
              {preview.frameworkName && preview.frameworkName !== 'Unnamed framework' ? (
                <p className="cm-oc__preview-fw">
                  <strong>Framework:</strong> {preview.frameworkName}
                </p>
              ) : null}
              <pre className="cm-oc__preview-body">
                {preview.postBody || preview.textPreview || '(no text)'}
              </pre>
              {preview.frameworkTemplate ? (
                <details className="cm-oc__preview-template">
                  <summary>Template slots</summary>
                  <pre>{preview.frameworkTemplate}</pre>
                </details>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
