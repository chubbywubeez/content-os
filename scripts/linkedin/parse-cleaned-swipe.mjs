/**
 * Parse a single `*_cleaned.md` swipe file (Codie-style output from clean-person-outliers.mjs).
 * Used by build-outliers-swipe-catalog.mjs and optionally at dev time.
 */
import fs from 'node:fs'

/**
 * @typedef {object} SwipeCatalogEntry
 * @property {string} id
 * @property {string} urn
 * @property {string} creator
 * @property {string} slug
 * @property {string} writerTag
 * @property {string} engagementHeader
 * @property {string} hook
 * @property {string} url
 * @property {number} likes
 * @property {number} comments
 * @property {number} shares
 * @property {string} formatLevel
 * @property {string} structural
 * @property {string} lengthTier
 * @property {number} charCount
 * @property {string} postBody
 * @property {string} frameworkName
 * @property {string} frameworkTemplate
 * @property {string} frameworkNote
 * @property {string[]} tags
 * @property {string} frameworkBody
 * @property {boolean} hasFramework
 * @property {string} searchText
 * @property {number} maxRatio
 * @property {string} sourceFile
 */

/**
 * @param {string} full
 * @param {string} sourceFile
 * @returns {{ creator: string, slug: string, entries: SwipeCatalogEntry[] }}
 */
export function parseCleanedSwipeMarkdown(full, sourceFile) {
  const displayMatch = full.match(/# Engagement outliers — \*\*([^*]+)\*\* \(`([^`]+)`\)/)
  const creator = displayMatch?.[1]?.trim() ?? 'Unknown'
  const slug = displayMatch?.[2]?.trim() ?? sourceFile.replace(/_cleaned\.md$/i, '')

  const writerTagMatch = full.match(/Writer tag:\s*`([^`]+)`/)
  const writerTag = writerTagMatch?.[1]?.trim() ?? slug.replace(/_/g, '-')

  const postsBlockMatch = full.match(/\n## 1\.\s/)
  if (!postsBlockMatch || postsBlockMatch.index == null) {
    return { creator, slug, entries: [] }
  }

  const postsBlock = full.slice(postsBlockMatch.index + 1)
  const summaryIdx = postsBlock.search(/\n## Summary\b/)
  const postsOnly = summaryIdx >= 0 ? postsBlock.slice(0, summaryIdx) : postsBlock
  const sections = postsOnly.split(/\n(?=## \d+\.\s)/).filter((s) => /^## \d+\./.test(s))

  /** @type {SwipeCatalogEntry[]} */
  const entries = []

  for (const section of sections) {
    const entry = parsePostSection(section, { creator, slug, writerTag, sourceFile })
    if (entry) entries.push(entry)
  }

  return { creator, slug, entries }
}

/**
 * @param {string} section
 * @param {{ creator: string, slug: string, writerTag: string, sourceFile: string }} meta
 * @returns {SwipeCatalogEntry | null}
 */
function parsePostSection(section, meta) {
  const headerMatch = section.match(/^## \d+\.\s*(.+)/m)
  if (!headerMatch) return null

  const engagementHeader = headerMatch[1].trim()
  const url = section.match(/- \*\*URL:\*\*\s*(https:\/\/\S+)/)?.[1] ?? ''
  const urn = section.match(/- \*\*URN:\*\*\s*`(urn:li:activity:[^`]+)`/)?.[1] ?? ''
  if (!urn) return null

  const eng = section.match(
    /- \*\*Engagement \(raw\):\*\*\s*(\d+)\s*likes\s*·\s*(\d+)\s*comments\s*·\s*(\d+)\s*shares/,
  )
  const likes = eng ? Number(eng[1]) : 0
  const comments = eng ? Number(eng[2]) : 0
  const shares = eng ? Number(eng[3]) : 0

  const hook = section.match(/- \*\*Hook:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const formatLevel = section.match(/\*\*Format-level:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const structural = section.match(/\*\*Structural:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const lengthTier = section.match(/\*\*Length tier:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
  const charCount = Number(section.match(/\*\*Char count:\*\*\s*(\d+)/)?.[1] ?? 0)

  const bodyMatch = section.match(/\*\*Full post:\*\*\s*\n+```\n([\s\S]*?)```/)
  const postBody = bodyMatch ? bodyMatch[1].replace(/\r\n/g, '\n') : ''
  if (!postBody.trim()) return null

  const fwNameMatch = section.match(/\*\*Framework — "([^"]+)":\*\*/)
  const frameworkName = fwNameMatch?.[1]?.trim() ?? 'Unnamed framework'

  const tmplMatch = section.match(
    /\*\*Framework — "[^"]+":\*\*\s*\n+```\n([\s\S]*?)```/,
  )
  const frameworkTemplate = tmplMatch ? tmplMatch[1].replace(/\r\n/g, '\n').trimEnd() : ''

  let frameworkNote = ''
  if (tmplMatch) {
    const afterTmpl = section.slice(section.indexOf(tmplMatch[0]) + tmplMatch[0].length)
    const noteBlock = afterTmpl.match(/^\s*\n+([\s\S]*?)(?=\n\*\*Tags:\*\*)/)
    if (noteBlock) {
      frameworkNote = noteBlock[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('---'))
        .join(' ')
        .trim()
    }
  }

  const tagsLine = section.match(/\*\*Tags:\*\*\s*(.+)/)?.[1] ?? ''
  const tags = tagsLine
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const formatTags = formatLevel
    ? formatLevel.split(/[,/]/).map((t) => t.trim()).filter(Boolean)
    : []
  const structuralTags = structural
    ? structural.split(/[,/]/).map((t) => t.trim()).filter((t) => t && t !== '_(not tagged)_')
    : []

  const frameworkBody = buildFrameworkBody(frameworkName, frameworkTemplate, frameworkNote, tags)
  const hasFramework = frameworkHasTemplate(frameworkName, frameworkTemplate)

  const searchText = [
    meta.creator,
    meta.slug,
    meta.writerTag,
    hook,
    urn,
    engagementHeader,
    frameworkName,
    ...formatTags,
    ...structuralTags,
    ...tags,
  ]
    .join(' ')
    .toLowerCase()

  return {
    id: urn,
    urn,
    creator: meta.creator,
    slug: meta.slug,
    writerTag: meta.writerTag,
    engagementHeader,
    hook,
    url,
    likes,
    comments,
    shares,
    formatLevel,
    structural,
    lengthTier,
    charCount,
    postBody,
    frameworkName,
    frameworkTemplate,
    frameworkNote,
    tags,
    frameworkBody,
    hasFramework,
    searchText,
    maxRatio: 0,
    sourceFile: meta.sourceFile,
    formatTags,
    structuralTags,
    textPreview: postBody.slice(0, 280),
    axes: engagementHeader,
  }
}

export function buildFrameworkBody(name, template, note, tags) {
  const parts = [`Framework mechanism: "${name}"`, '', 'Fill-in template:', template.trim()]
  if (note) parts.push('', `Mechanism note: ${note}`)
  if (tags.length) parts.push('', `Tags: ${tags.join(', ')}`)
  return parts.join('\n')
}

export function frameworkHasTemplate(name, template) {
  const t = template.trim()
  if (t.length >= 80) return true
  if (name !== 'Unnamed framework' && t.length >= 24) return true
  return false
}

/**
 * @param {string} filePath
 */
export function parseCleanedSwipeFile(filePath) {
  const base = filePath.split(/[/\\]/).pop() ?? filePath
  const full = fs.readFileSync(filePath, 'utf8')
  return parseCleanedSwipeMarkdown(full, base)
}
