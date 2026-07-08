import { useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent } from 'react'
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

const METRIC_EMOJI: Record<string, string> = {
  likes: '👍',
  reactions: '❤️',
  comments: '💬',
  shares: '🔄',
  reposts: '🔁',
  views: '👁️',
  impressions: '👁️',
  saves: '🔖',
}

type ParsedMetric = { emoji: string; label: string; value: string; multiplier: string | null }

/** Parse axes like "**Likes outlier** — 1,972 reactions ≈ **14.81×** mean · **Comments outlier** — ..." */
function parseAxes(axes: string): ParsedMetric[] {
  if (!axes) return []
  return axes
    .split(/\s·\s|\s•\s|\s\+\s/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): ParsedMetric | null => {
      const clean = chunk.replace(/\*\*/g, '')
      const labelMatch = clean.match(/^([A-Za-z]+)\s+outlier/i)
      const label = labelMatch ? labelMatch[1] : clean.split(/\s+/)[0]
      const key = label.toLowerCase()
      const emoji = METRIC_EMOJI[key] ?? '📈'
      const valueMatch = clean.match(/—\s*([\d,]+(?:\.\d+)?)/) || clean.match(/([\d,]+(?:\.\d+)?)\s+(?:reactions|comments|shares|reposts|views|impressions)/i)
      const value = valueMatch ? valueMatch[1] : ''
      const multMatch = clean.match(/([\d.]+)\s*×/)
      const multiplier = multMatch ? `${Math.round(parseFloat(multMatch[1]))}x` : null
      if (!value && !multiplier) return null
      return { emoji, label, value, multiplier }
    })
    .filter((x): x is ParsedMetric => x !== null)
}

type Props = {
  entries: OutlierCatalogEntry[]
  loading: boolean
  errorMessage: string | null
  onRefresh: () => void
  /** Framework mode: rows without a usable template are disabled. */
  requireFramework: boolean
  /** `swipe` = cleaned markdown catalog; `remote` = daily cron catalog; `legacy` = index + architecture cache. */
  catalogSource?: 'swipe' | 'remote' | 'legacy'
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
  const listRef = useRef<HTMLDivElement | null>(null)

  // Word count + bucket per entry, plus top suggested tags by frequency.
  const enriched = useMemo(() => {
    return entries.map((e) => {
      const words = wordCount(e.postBody || e.textPreview || '')
      return { e, words, bucket: bucketFor(words) }
    })
  }, [entries])

  // Top tag list is computed once from the full catalog so chips don't shuffle as you filter.
  const topTagList = useMemo(() => {
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
      .map(([tag]) => tag)
  }, [enriched])

  // Leave-one-out facet counts: each chip's count = matches when its own filter is relaxed
  // but all OTHER active filters still apply. So selecting one chip narrows the rest.
  const facetCounts = useMemo(() => {
    const t = q.trim().toLowerCase()
    const lengthCounts: Record<LengthBucket, number> = { short: 0, medium: 0, long: 0, mega: 0 }
    const tagCounts = new Map<string, number>()
    for (const tag of topTagList) tagCounts.set(tag, 0)

    for (const row of enriched) {
      // Apply search + tag filters (length relaxed) for length-chip counts.
      const passSearch = !t || row.e.searchText.includes(t)
      if (!passSearch) continue
      const tagSet = new Set([...row.e.formatTags, ...row.e.structuralTags])
      let passActiveTags = true
      for (const need of activeTags) if (!tagSet.has(need)) { passActiveTags = false; break }
      if (passActiveTags) {
        lengthCounts[row.bucket] += 1
      }
      // Per-tag counts: apply search + length + all OTHER active tags, then check this tag.
      const passLength = !activeLength || row.bucket === activeLength
      if (!passLength) continue
      for (const tag of topTagList) {
        const others = activeTags
        let ok = true
        for (const need of others) {
          if (need === tag) continue
          if (!tagSet.has(need)) { ok = false; break }
        }
        if (ok && tagSet.has(tag)) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
      }
    }
    return { lengthCounts, tagCounts }
  }, [enriched, q, activeTags, activeLength, topTagList])

  const topTags = useMemo(
    () => topTagList.map((tag) => ({ tag, count: facetCounts.tagCounts.get(tag) ?? 0 })),
    [topTagList, facetCounts],
  )
  const lengthCounts = facetCounts.lengthCounts

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
    let rows = list.slice(0, MAX_ROWS)
    const selectedRow = selectedUrn ? list.find((row) => row.e.urn === selectedUrn) : null
    if (selectedRow && !rows.some((row) => row.e.urn === selectedUrn)) {
      rows = [selectedRow, ...rows.slice(0, MAX_ROWS - 1)]
    }
    return { rows, total, capped: total > MAX_ROWS }
  }, [enriched, q, activeLength, activeTags, selectedUrn])

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

  useEffect(() => {
    const list = listRef.current
    if (!list || !selectedUrn) return
    const selectedEl = list.querySelector<HTMLElement>('.cm-oc__row--selected')
    if (!selectedEl) return

    const nextTop = Math.max(0, selectedEl.offsetTop - list.offsetTop - 8)
    list.scrollTo({ top: nextTop, behavior: 'smooth' })
  }, [selectedUrn, filtered.rows])

  const filtersActive = activeTags.size > 0 || activeLength !== null || q.trim().length > 0

  const handlePickerWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

    const list = listRef.current
    if (!list) return

    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('.cm-oc__list')) return

    const nestedScrollable = target?.closest<HTMLElement>('.cm-oc__preview-body, .cm-oc__preview-template pre')
    if (nestedScrollable && nestedScrollable.scrollHeight > nestedScrollable.clientHeight) {
      const nestedMax = nestedScrollable.scrollHeight - nestedScrollable.clientHeight
      const nestedCanScroll = event.deltaY < 0 ? nestedScrollable.scrollTop > 0 : nestedScrollable.scrollTop < nestedMax
      if (nestedCanScroll) return
    }

    const maxScroll = list.scrollHeight - list.clientHeight
    if (maxScroll <= 0) return

    const nextScroll = Math.max(0, Math.min(maxScroll, list.scrollTop + event.deltaY))
    if (nextScroll === list.scrollTop) return

    event.preventDefault()
    list.scrollTop = nextScroll
  }

  return (
    <div className="cm-oc" onMouseLeave={() => setHovered(null)} onWheel={handlePickerWheel}>
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
      {catalogSource === 'legacy' && (
        <p className="cm-note cm-note--warn">
          Legacy catalog (index + architecture cache). Run{' '}
          <code className="cm-inline-code">npm run swipe:catalog</code> in <code className="cm-inline-code">copy-maker</code>{' '}
          after generating <code className="cm-inline-code">*_cleaned.md</code> files.
        </p>
      )}
      <div className="cm-oc__split">
        <div ref={listRef} className="cm-oc__list" role="listbox" aria-label="Outlier posts">
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
                  <span className="cm-oc__axes">
                    {parseAxes(e.axes).map((m, i) => (
                      <span key={`${e.urn}-m-${i}`} className="cm-oc__metric" title={m.label}>
                        <span className="cm-oc__metric-emoji" aria-label={m.label}>
                          {m.emoji}
                        </span>
                        {m.value}
                        {m.multiplier ? <span className="cm-oc__metric-mult"> ({m.multiplier})</span> : null}
                      </span>
                    ))}
                  </span>
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
