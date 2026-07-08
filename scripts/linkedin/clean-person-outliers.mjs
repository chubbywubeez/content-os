/**
 * Converts `outliers_by_person/*.md` (verbose + Post architecture extraction) into
 * cleaned swipe-file markdown matching the Codie-style contract (Framework + Tags, dedupe, Summary).
 *
 * Usage (from repo root):
 *   node scripts/linkedin/clean-person-outliers.mjs dickiebush donnellychris george-mack
 *
 * Output: `data/outliers/data/outliers_by_person/<slug>_cleaned.md`
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const PERSON_DIR = path.join(ROOT, 'data', 'outliers', 'data', 'outliers_by_person')

function readArgSlugs() {
  const a = process.argv.slice(2).filter((x) => x && !x.startsWith('-'))
  if (a.length === 0) {
    console.error('Usage: node clean-person-outliers.mjs <slug> [slug ...]')
    process.exit(1)
  }
  return a.map((s) => s.replace(/\.md$/i, ''))
}

function extractBacktickSlug(preamble) {
  const m = preamble.match(/\(`([^`]+)`\)/)
  return m ? m[1] : 'unknown'
}

function extractDisplayName(preamble) {
  const m = preamble.match(/# Engagement outliers — \*\*([^*]+)\*\*/)
  return m ? m[1].trim() : 'Unknown'
}

function extractSourceStats(preamble) {
  const posts = (preamble.match(/\*\*Posts analyzed:\*\*\s*(\d+)/) ||
    preamble.match(/- \*\*Posts analyzed:\*\*\s*(\d+)/))?.[1]
  const means =
    preamble.match(/- \*\*Means —\*\*\s*likes:\s*([\d.]+)\s*·\s*comments:\s*([\d.]+)\s*·\s*shares:\s*([\d.]+)/) ||
    preamble.match(/\*\*Means —\*\*\s*likes:\s*([\d.]+)\s*·\s*comments:\s*([\d.]+)\s*·\s*shares:\s*([\d.]+)/)
  const five = preamble.match(/### 5× outliers \((\d+) posts\)/)?.[1]
  return {
    postsAnalyzed: posts || '?',
    meanLikes: means?.[1] ?? '?',
    meanComments: means?.[2] ?? '?',
    meanShares: means?.[3] ?? '?',
    fiveTimesCount: five || '?',
  }
}

function splitPostChunks(full) {
  const m = full.match(/\n(#### \d+\.\s)/)
  if (!m) throw new Error('No #### post headers found')
  const splitAt = full.indexOf(m[0])
  const preamble = full.slice(0, splitAt).trimEnd()
  const rest = full.slice(splitAt + 1) // drop leading \n
  const parts = rest.split(/\n(?=#### \d+\.\s)/)
  return { preamble, parts }
}

function parsePostChunk(chunk, sourceIndex) {
  const lines = chunk.split('\n')
  const headerLine = lines[0]?.replace(/^####\s*\d+\.\s*/, '').trim() || 'Outlier'
  const url = chunk.match(/- \*\*URL:\*\*\s*(https:\/\/\S+)/)?.[1] ?? ''
  const urn = chunk.match(/- \*\*URN:\*\*\s*`(urn:li:activity:[^`]+)`/)?.[1] ?? ''
  const eng = chunk.match(/- \*\*Engagement \(raw\):\*\*\s*(\d+)\s*likes\s*·\s*(\d+)\s*comments\s*·\s*(\d+)\s*shares/)
  const likes = eng ? Number(eng[1]) : 0
  const comments = eng ? Number(eng[2]) : 0
  const shares = eng ? Number(eng[3]) : 0
  const hook = chunk.match(/- \*\*Hook:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const formatLevel = chunk.match(/\*\*Format-level:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const structural = chunk.match(/\*\*Structural:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const lengthTier = chunk.match(/\*\*Length tier:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const charCount = chunk.match(/\*\*Char count:\*\*\s*(\d+)/)?.[1] ?? '0'

  // Body fence is usually ```text but some exports use bare ```.
  const bodyMatch = chunk.match(
    /\*\*Full post\*\*:?[\s\S]*?```(?:text)?\n([\s\S]*?)```/,
  )
  const bodyRaw = bodyMatch ? bodyMatch[1] : ''
  const body = bodyRaw.replace(/\r\n/g, '\n')

  const missingExtraction = /No framework block yet/i.test(chunk)

  const fwName =
    chunk.match(/- \*\*Framework name\*\*:\s*(.+)/)?.[1]?.trim() ??
    chunk.match(/\*\*Framework name\*\*:\s*(.+)/)?.[1]?.trim() ??
    'Unnamed framework'

  const oneLine =
    chunk.match(/- \*\*One-line essence\*\*:\s*(.+)/)?.[1]?.trim() ??
    chunk.match(/\*\*One-line essence\*\*:\s*(.+)/)?.[1]?.trim() ??
    ''

  // Section title varies: "Reusable Template (the deliverable)" or "Reusable Template" only; fence may be ``` or ```text.
  const tmplBlock = chunk.match(
    /## 9\. Reusable Template[^\n]*\s*\n+```(?:text)?\n([\s\S]*?)```/,
  )
  const template = tmplBlock ? tmplBlock[1].replace(/\r\n/g, '\n').trimEnd() : ''

  const score = likes + comments * 2 + shares * 3
  const bodyKey = body.replace(/\r\n/g, '\n').trim()
  return {
    sourceIndex,
    headerLine,
    url,
    urn,
    likes,
    comments,
    shares,
    hook,
    formatLevel,
    structural,
    lengthTier,
    charCount,
    body,
    bodyKey,
    fwName,
    oneLine,
    template,
    score,
    missingExtraction,
  }
}

function slugifyTag(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildTags(writerSlug, formatLevel, structural, hook) {
  const tags = new Set([`writer:${writerSlug.replace(/_/g, '-')}`])
  if (formatLevel) {
    for (const p of formatLevel.split(/[,/]/)) {
      const t = slugifyTag(p)
      if (t) tags.add(t)
    }
  }
  if (structural) {
    for (const p of structural.split(/[,/]/)) {
      const t = slugifyTag(p)
      if (t) tags.add(t)
    }
  }
  const hookWords = hook
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 3)
  for (const w of hookWords) tags.add(slugifyTag(w))
  return [...tags].filter(Boolean)
}

function dedupePosts(parsed) {
  /** @type {Map<string, {winner: typeof parsed[0], urns: string[], losers: number[]}>} */
  const map = new Map()
  const empty = []
  for (const p of parsed) {
    if (!p.bodyKey || p.charCount === '0') {
      empty.push(p.sourceIndex + 1)
      continue
    }
    const g = map.get(p.bodyKey)
    if (!g) {
      map.set(p.bodyKey, { winner: p, urns: [p.urn], losers: [] })
    } else {
      g.urns.push(p.urn)
      if (p.score > g.winner.score) {
        g.losers.push(g.winner.sourceIndex + 1)
        g.winner = p
      } else {
        g.losers.push(p.sourceIndex + 1)
      }
    }
  }
  const retained = [...map.values()]
    .map((g) => ({ ...g.winner, collapsedUrns: g.urns, collapsedFrom: g.losers }))
    .sort((a, b) => a.sourceIndex - b.sourceIndex)

  const collapseNotes = [...map.values()]
    .filter((g) => g.urns.length > 1)
    .map((g) => ({
      keptUrn: g.winner.urn,
      urns: g.urns,
      droppedSourceRows: g.losers,
    }))
  return { retained, empty, collapseNotes }
}

function buildFile({
  displayName,
  writerSlug,
  stats,
  retained,
  empty,
  collapseNotes,
  unenrichedSourceChunks,
}) {
  const today = new Date().toISOString().slice(0, 10)
  const lines = []
  lines.push(`# Engagement outliers — **${displayName}** (\`${writerSlug}\`)`)
  lines.push('')
  lines.push(
    `*Generated: ${today} · Cleanup pass: Framework + Tags added as structural layers · Writer tag: \`${writerSlug.replace(/_/g, '-')}\`*`,
  )
  lines.push('')
  lines.push('## Method')
  lines.push('')
  lines.push(
    'Each retained post keeps original engagement metadata and **verbatim** full post text from the source. The verbose `### Post architecture extraction` blocks were removed.',
  )
  lines.push('')
  lines.push(
    '- **Framework:** taken from the cached extraction’s **Framework name** plus the fenced template under `## 9. Reusable Template (the deliverable)`. If a template was missing, a minimal bracketed scaffold was generated from the hook + structure.',
  )
  lines.push(
    '- **Tags:** lowercase, hyphenated — writer slug, format/structural hints, and a few hook-derived tokens.',
  )
  lines.push(
    '- **Dedupe:** posts with identical full body (after trim) collapsed to the highest engagement score; all URNs in a group are noted on the retained row.',
  )
  lines.push(
    '- **Discards:** posts with empty body or `char_count` 0 are listed only in the Summary.',
  )
  if (unenrichedSourceChunks > 0) {
    lines.push(
      `- **Source gaps:** ${unenrichedSourceChunks} outlier row(s) in the source file still have the “no framework block yet” placeholder (no cached LLM extraction). For those rows the **Framework** title defaults to “Unnamed framework” and the bracketed template is a generic scaffold — re-run your enrichment pipeline / cache when you want named mechanisms + full templates.`,
    )
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(`- **Posts analyzed in source:** ${stats.postsAnalyzed}`)
  lines.push(`- **Means —** likes: ${stats.meanLikes} · comments: ${stats.meanComments} · shares: ${stats.meanShares}`)
  lines.push(`- **5× outliers in source:** ${stats.fiveTimesCount} posts`)
  lines.push(`- **Posts retained (deduped + body text):** ${retained.length}`)
  lines.push(
    `- **Posts discarded (empty body / char_count 0):** ${empty.length ? `source #${empty.join(', #')}` : 'none'}`,
  )
  lines.push(`- **Duplicate body groups collapsed:** ${collapseNotes.length} groups`)
  lines.push('')
  lines.push('---')
  lines.push('')

  let n = 0
  for (const p of retained) {
    n++
    const dupNote =
      p.collapsedUrns.length > 1
        ? ` (Note: duplicate body — ${p.collapsedUrns.length} URNs merged; kept highest engagement)`
        : ''
    lines.push(`## ${n}. ${p.headerLine}${dupNote}`)
    lines.push('')
    lines.push(`- **URL:** ${p.url}`)
    lines.push(`- **URN:** \`${p.urn}\``)
    if (p.collapsedUrns.length > 1) {
      lines.push(`- **URNs in this group:** ${p.collapsedUrns.map((u) => `\`${u}\``).join(' · ')}`)
    }
    lines.push(`- **Engagement (raw):** ${p.likes} likes · ${p.comments} comments · ${p.shares} shares`)
    lines.push(`- **Hook:** ${p.hook}`)
    lines.push('')
    lines.push(`**Format-level:** ${p.formatLevel}`)
    lines.push(`**Structural:** ${p.structural}`)
    lines.push(`**Length tier:** ${p.lengthTier}`)
    lines.push(`**Char count:** ${p.charCount}`)
    lines.push('')
    lines.push('**Full post:**')
    lines.push('')
    lines.push('```')
    lines.push(p.body)
    lines.push('```')
    lines.push('')
    lines.push(`**Framework — "${p.fwName}":**`)
    lines.push('')
    let tmpl =
      p.template.trim() ||
      `[HOOK LINE]\n\n[BODY — match source structure: ${p.structural || 'list or short form'}]`
    if (/deck/i.test(p.formatLevel) && !/\bdeck\b|\bcarousel\b|\bslide\b/i.test(tmpl)) {
      tmpl += `\n\n[DECK / CAROUSEL: The attached visual deck carries the main proof or examples; this caption only tees it up.]`
    }
    lines.push('```')
    lines.push(tmpl)
    lines.push('```')
    lines.push('')
    if (p.oneLine) {
      lines.push(p.oneLine)
      lines.push('')
    }
    const tagStr = buildTags(writerSlug, p.formatLevel, p.structural, p.hook).join(', ')
    lines.push(`**Tags:** ${tagStr}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  lines.push('## Summary')
  lines.push('')
  lines.push(
    `Source analyzed **${stats.postsAnalyzed}** posts with **${stats.fiveTimesCount}** five-fold outliers; **${retained.length}** retained after dedupe + body filter; **${empty.length}** empty-body discards; **${collapseNotes.length}** duplicate-body groups merged.`,
  )
  lines.push('')
  if (collapseNotes.length) {
    lines.push('**Duplicate body groups (URNs merged):**')
    for (const c of collapseNotes) {
      lines.push(`- Kept \`${c.keptUrn}\` ← ${c.urns.map((u) => `\`${u}\``).join(', ')}`)
    }
    lines.push('')
  }
  const fwCounts = new Map()
  for (const p of retained) {
    fwCounts.set(p.fwName, (fwCounts.get(p.fwName) || 0) + 1)
  }
  const sortedFw = [...fwCounts.entries()].sort((a, b) => b[1] - a[1])
  const unnamed = fwCounts.get('Unnamed framework') || 0
  lines.push('**Signature mechanics (from retained set — framework name frequency):**')
  if (unnamed > 0) {
    lines.push(
      `- **Unnamed framework** — ${unnamed}× (placeholder title whenever the source row has no extraction; bracketed scaffold only)`,
    )
  }
  const restFw = sortedFw.filter(([n]) => n !== 'Unnamed framework').slice(0, 24)
  for (const [name, c] of restFw) {
    lines.push(`- **${name}** — ${c}×`)
  }
  lines.push('')
  lines.push(
    `**Confirm:** ${retained.length} numbered posts; empty discards ${empty.length}; merged groups ${collapseNotes.length}; every post has Framework + Tags; writer tag on every post.`,
  )
  lines.push('')
  return lines.join('\n')
}

function processFile(slug) {
  const inPath = path.join(PERSON_DIR, `${slug}.md`)
  if (!fs.existsSync(inPath)) {
    console.error('Missing:', inPath)
    return
  }
  const full = fs.readFileSync(inPath, 'utf8')
  const { preamble, parts } = splitPostChunks(full)
  const writerSlug = extractBacktickSlug(preamble)
  const displayName = extractDisplayName(preamble)
  const stats = extractSourceStats(preamble)
  const parsed = parts.map((chunk, i) => parsePostChunk(chunk, i))
  const unenrichedSourceChunks = parsed.filter((p) => p.missingExtraction).length
  const { retained, empty, collapseNotes } = dedupePosts(parsed)
  const out = buildFile({
    displayName,
    writerSlug,
    stats,
    retained,
    empty,
    collapseNotes,
    unenrichedSourceChunks,
  })
  const outPath = path.join(PERSON_DIR, `${slug}_cleaned.md`)
  fs.writeFileSync(outPath, out, 'utf8')
  console.log('Wrote', outPath, 'retained', retained.length, 'from', parts.length, 'chunks')
}

const slugs = readArgSlugs()
for (const s of slugs) {
  try {
    processFile(s)
  } catch (e) {
    console.error('Failed', s, e.message)
  }
}

// Rebuild app catalog JSON whenever cleaned swipe files change.
const buildCatalog = path.join(__dirname, 'build-outliers-swipe-catalog.mjs')
if (fs.existsSync(buildCatalog)) {
  try {
    execSync(`node "${buildCatalog}"`, { stdio: 'inherit', cwd: ROOT })
  } catch (e) {
    console.error('Swipe catalog build failed:', e.message)
  }
}
