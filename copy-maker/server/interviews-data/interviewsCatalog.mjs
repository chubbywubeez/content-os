import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { walkInterviewMarkdown, relPosix } from '../../../Problem Presentations/copy_mining/tools/lib_rollups.mjs'
import { parseScoreSummary } from '../transcript-pipeline/grade.mjs'
import { inferPersonaFromScore } from './inferPersona.mjs'
import { parseSpeakerDialogue } from '../transcript-pipeline/parseSpeakers.mjs'
import { heuristicCallType } from '../transcript-pipeline/classifyCallType.mjs'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(SERVER_DIR, '../../..')
export const PRESENTATIONS_DIR = path.join(REPO_ROOT, 'Problem Presentations')
export const SCORES_DIR = path.join(PRESENTATIONS_DIR, 'scores')
export const PER_INTERVIEW_DIR = path.join(PRESENTATIONS_DIR, 'copy_mining', 'per_interview')

const COMPOSITE_RE =
  /\*\*[^*\n]*?(?:Interim\s+)?Composite\s+Score:\s*([\d.]+)\s*\/\s*100\*\*/i
const NO_COMPOSITE_HINT =
  /(NOT\s+CALCULATED|no\s+composite\s+is\s+produced|Do\s+not\s+continue\s+scoring|fabricating\s+scores\s+from\s+non-existent)/i

/** @typedef {'interview' | 'demo'} CallType */

/**
 * @param {string} stem
 */
export function displayNameFromStem(stem) {
  return stem
    .replace(/\s+Problem\s*(Statement|Transcript)?\s*$/i, '')
    .replace(/\s+Demo\s*(Transcript)?\s*$/i, '')
    .replace(/\s+Meeting\s+Transcript\s*$/i, '')
    .replace(/\s+Transcript\s*$/i, '')
    .replace(/\s+Probelm\s*$/i, '')
    .replace(/\s+-Problem\s*/i, ' ')
    .replace(/\s+problem\s*$/i, '')
    .trim()
}

/**
 * @param {string} text
 */
function parseComposite(text) {
  const m = text.match(COMPOSITE_RE)
  if (m) return Number(m[1])
  if (NO_COMPOSITE_HINT.test(text)) return null
  return null
}

/**
 * @param {string} text
 * @param {number | null} composite
 * @param {CallType} callType
 */
function gradeLabel(text, composite, callType) {
  if (callType === 'demo' && !text) return 'Demo'
  const summary = parseScoreSummary(text || '')
  if (composite != null && !Number.isNaN(composite)) {
    const letter = summary.classification?.charAt(0) ?? ''
    return letter ? `${composite.toFixed(1)} · ${letter}` : String(composite.toFixed(1))
  }
  if (summary.classification) return summary.classification.split('—')[0]?.trim() ?? '—'
  return callType === 'demo' ? 'Demo' : 'N/C'
}

/**
 * @param {string} scoreMd
 */
export function extractCallSummary(scoreMd) {
  if (!scoreMd?.trim()) return 'No summary available.'
  const oneLine = scoreMd.match(/##\s*BEST ONE-LINE ANSWER\s*\n+\*([^*]+)\*/i)?.[1]
  if (oneLine?.trim()) return oneLine.trim()

  const rawRead = scoreMd.match(/##\s*[^#\n]*Pre-Score Raw Read\s*\n+([\s\S]*?)(?=\n##\s)/i)?.[1]
  if (rawRead?.trim()) {
    const para = rawRead.trim().split(/\n\n+/)[0]?.trim()
    if (para && para.length > 40) return para
  }

  const rationale = scoreMd.match(
    /##\s*CLASSIFICATION\s*[\s\S]*?\*Rationale:\*\s*([^*\n]+(?:\n(?!\*|---)[^*\n]+)*)/i,
  )?.[1]
  if (rationale?.trim()) return rationale.trim().replace(/\s+/g, ' ').slice(0, 500)

  const summary = parseScoreSummary(scoreMd)
  return summary.classification ?? 'No summary available.'
}

/**
 * @param {string} stem
 */
function readMeta(stem) {
  const fp = path.join(PER_INTERVIEW_DIR, `${stem}.meta.json`)
  if (!fs.existsSync(fp)) return null
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch {
    return null
  }
}

/**
 * @param {string} stem
 * @param {object | null} meta
 * @param {string} [transcriptMd]
 * @returns {CallType}
 */
export function resolveCallType(stem, meta, transcriptMd = '') {
  if (meta?.callType === 'demo' || meta?.callType === 'interview') return meta.callType
  if (meta?.mode === 'three') return 'demo'
  if (/\bdemo\b/i.test(stem)) return 'demo'

  if (transcriptMd) {
    const parsed = parseSpeakerDialogue(transcriptMd)
    const h = heuristicCallType({ parsed, cleaned: transcriptMd })
    if (h.callType === 'demo' && h.confidence >= 0.85) return 'demo'
    if (h.callType === 'interview' && h.confidence >= 0.85) return 'interview'
  }

  return 'interview'
}

/**
 * @param {string} stem
 */
function findTranscriptFile(stem) {
  const direct = path.join(PRESENTATIONS_DIR, `${stem}.md`)
  if (fs.existsSync(direct)) return direct

  const all = walkInterviewMarkdown(PRESENTATIONS_DIR)
  const norm = stem.toLowerCase()
  for (const fp of all) {
    const base = path.basename(fp, '.md').toLowerCase()
    if (base === norm) return fp
  }
  for (const fp of all) {
    const base = path.basename(fp, '.md').toLowerCase()
    if (base.startsWith(norm) || norm.startsWith(base)) return fp
  }
  return null
}

function collectStems() {
  const stems = new Set()
  if (fs.existsSync(SCORES_DIR)) {
    for (const f of fs.readdirSync(SCORES_DIR)) {
      if (f.endsWith('.score.md')) stems.add(f.replace(/\.score\.md$/i, ''))
    }
  }
  if (fs.existsSync(PER_INTERVIEW_DIR)) {
    for (const f of fs.readdirSync(PER_INTERVIEW_DIR)) {
      if (f.endsWith('.meta.json')) stems.add(f.replace(/\.meta\.json$/i, ''))
      if (f.endsWith('.json') && !f.endsWith('.meta.json')) {
        stems.add(f.replace(/\.json$/i, ''))
      }
    }
  }
  return [...stems]
}

/**
 * @param {CallType} [callTypeFilter]
 */
export function listCalls(callTypeFilter) {
  const items = []

  for (const stem of collectStems()) {
    const meta = readMeta(stem)
    const transcriptPath = findTranscriptFile(stem)
    const transcriptMd = transcriptPath ? fs.readFileSync(transcriptPath, 'utf8') : ''
    const callType = resolveCallType(stem, meta, transcriptMd)

    if (callTypeFilter && callType !== callTypeFilter) continue

    const scorePath = path.join(SCORES_DIR, `${stem}.score.md`)
    const scoreMd = fs.existsSync(scorePath) ? fs.readFileSync(scorePath, 'utf8') : ''
    const composite = scoreMd ? parseComposite(scoreMd) : null
    const metaPersona = meta?.persona ?? null
    const persona =
      callType === 'interview'
        ? inferPersonaFromScore({ scoreMd, composite, metaPersona })
        : null
    const quotesPath = path.join(PER_INTERVIEW_DIR, `${stem}.json`)

    items.push({
      stem,
      displayName: displayNameFromStem(stem),
      callType,
      persona,
      grade: gradeLabel(scoreMd, composite, callType),
      composite,
      hasTranscript: Boolean(transcriptPath),
      hasQuotes: fs.existsSync(quotesPath),
      hasScore: Boolean(scoreMd),
    })
  }

  items.sort((a, b) => {
    if (a.callType !== b.callType) return a.callType.localeCompare(b.callType)
    const ac = a.composite ?? -1
    const bc = b.composite ?? -1
    if (bc !== ac) return bc - ac
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })

  return items
}

/** @param {CallType} [filter] */
export function listInterviews(filter) {
  return listCalls(filter ?? 'interview')
}

export function listDemos() {
  return listCalls('demo')
}

/**
 * @param {string} stemParam
 */
export function getInterviewDetail(stemParam) {
  const stem = decodeURIComponent(stemParam)
  const meta = readMeta(stem)
  const transcriptPath = findTranscriptFile(stem)
  const transcriptMd = transcriptPath ? fs.readFileSync(transcriptPath, 'utf8') : ''
  const callType = resolveCallType(stem, meta, transcriptMd)

  const scorePath = path.join(SCORES_DIR, `${stem}.score.md`)
  const scoreMd = fs.existsSync(scorePath) ? fs.readFileSync(scorePath, 'utf8') : ''
  if (!scoreMd && !transcriptMd) return null
  const composite = scoreMd ? parseComposite(scoreMd) : null
  const scoreSummary = scoreMd ? parseScoreSummary(scoreMd) : null
  const metaPersona = meta?.persona ?? null
  const persona =
    callType === 'interview'
      ? inferPersonaFromScore({ scoreMd, composite, metaPersona })
      : null

  const quotesPath = path.join(PER_INTERVIEW_DIR, `${stem}.json`)
  let quotes = null
  if (fs.existsSync(quotesPath)) {
    try {
      quotes = JSON.parse(fs.readFileSync(quotesPath, 'utf8'))
    } catch {
      quotes = null
    }
  }

  const summary =
    scoreMd && callType === 'interview'
      ? extractCallSummary(scoreMd)
      : meta?.rationale?.trim() ||
        (transcriptMd
          ? transcriptMd.replace(/^#.+$/m, '').trim().slice(0, 400)
          : 'No summary available.')

  return {
    stem,
    displayName: displayNameFromStem(stem),
    callType,
    persona,
    grade: gradeLabel(scoreMd, composite, callType),
    composite,
    classification: scoreSummary?.classification ?? null,
    hypothesisPct: scoreSummary?.hypothesisPct ?? null,
    summary,
    transcript: transcriptPath
      ? { markdown: transcriptMd, path: relPosix(PRESENTATIONS_DIR, transcriptPath) }
      : null,
    score: scoreMd
      ? {
          markdown: scoreMd,
          path: relPosix(PRESENTATIONS_DIR, scorePath),
          summary: scoreSummary,
        }
      : null,
    quotes,
    meta,
  }
}

/**
 * @param {ReturnType<typeof getInterviewDetail>} detail
 */
export function buildInterviewExportMarkdown(detail) {
  if (!detail) return ''
  const parts = [
    `# ${detail.displayName}`,
    '',
    `**Call type:** ${detail.callType}`,
  ]
  if (detail.persona) parts.push(`**Persona:** ${detail.persona.toUpperCase()}`)
  parts.push(`**Grade:** ${detail.grade}`, '', '## Call summary', '', detail.summary, '')

  if (detail.quotes?.snippets?.length) {
    parts.push('## Quotes', '')
    for (const s of detail.quotes.snippets) {
      parts.push(`> "${String(s.pull_quote || '').replace(/"/g, "'")}"`, '')
      if (s.theme_tag) parts.push(`*Theme: ${s.theme_tag}*`, '')
    }
    parts.push('')
  }

  if (detail.transcript?.markdown) {
    parts.push('## Transcript', '', detail.transcript.markdown.trim(), '')
  }

  return parts.join('\n').trimEnd() + '\n'
}
