import fs from 'node:fs'
import path from 'node:path'
import {
  CHUNKS_DIR,
  CHUNK_INTERPRETATIONS_DIR,
  PER_INTERVIEW_DIR,
  PRESENTATIONS_DIR,
  ensureDirs,
} from './paths.mjs'
import {
  chunkTranscriptPass1,
  getHypothesisConfigFromEnv,
  interpretChunksPass2,
} from './chunking.mjs'
import { cleanRawTranscript, parseSpeakerDialogue } from './parseSpeakers.mjs'

const VANTUM_SPEAKER = /\b(brian|tabarak|vantum|tupac)\b/i

function walkMarkdown(dir, out) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name)
    const st = fs.statSync(fp)
    if (st.isDirectory()) {
      if (name === 'scores' || name === 'copy_mining' || name === 'pipeline') continue
      walkMarkdown(fp, out)
      continue
    }
    if (!name.toLowerCase().endsWith('.md')) continue
    if (name === 'ALL_PARSED_INTERVIEWS.md') continue
    out.push(fp)
  }
}

function parseTurnsFromMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const turns = []
  let current = null

  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t || t.startsWith('#') || t === '---' || t === '## Dialogue') continue

    const bold = /^\*\*([^*]+)\*\*(?:\s*\([^)]+\))?\s*$/.exec(t)
    if (bold) {
      if (current?.text.trim()) turns.push(current)
      current = { speaker: bold[1].trim(), text: '' }
      continue
    }

    const colon = /^([A-Za-z][A-Za-z0-9 '&.,-]{0,72}):\s*(.*)$/.exec(t)
    if (colon) {
      if (current?.text.trim()) turns.push(current)
      current = { speaker: colon[1].trim(), text: colon[2].trim() }
      continue
    }

    if (!current) continue
    current.text += (current.text ? '\n' : '') + t
  }

  if (current?.text.trim()) turns.push(current)
  return turns
}

function loadRepoEnv() {
  const repoRoot = path.resolve(PRESENTATIONS_DIR, '..', '..')
  const envPath = path.join(repoRoot, '.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 1) continue
    const key = t.slice(0, idx).trim()
    const value = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!key) continue
    if (!(key in process.env)) process.env[key] = value
  }
}

function inferParticipant(turns) {
  const counts = new Map()
  for (const t of turns) {
    if (VANTUM_SPEAKER.test(t.speaker)) continue
    counts.set(t.speaker, (counts.get(t.speaker) || 0) + t.text.length)
  }
  let best = 'Participant'
  let bestLen = 0
  for (const [speaker, len] of counts.entries()) {
    if (len > bestLen) {
      bestLen = len
      best = speaker
    }
  }
  return best
}

function guessCallType(stem, meta) {
  if (meta?.callType === 'demo' || meta?.callType === 'interview') return meta.callType
  if (/\bdemo\b/i.test(stem)) return 'demo'
  return 'interview'
}

function loadMeta(stem) {
  const fp = path.join(PER_INTERVIEW_DIR, `${stem}.meta.json`)
  if (!fs.existsSync(fp)) return null
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch {
    return null
  }
}

function parseArgs(argv) {
  let parallel = 1
  let force = false
  const stems = []
  for (const raw of argv) {
    const a = raw.trim()
    if (!a) continue
    if (a.startsWith('--parallel=')) {
      const n = Number(a.split('=')[1])
      if (Number.isFinite(n) && n > 0) parallel = Math.floor(n)
      continue
    }
    if (a === '--force') {
      force = true
      continue
    }
    stems.push(a.toLowerCase())
  }
  return { parallel, force, stemFilters: stems }
}

async function processTranscript(fp, hypothesis, force) {
  const stem = path.basename(fp, '.md')
  const chunkPath = path.join(CHUNKS_DIR, `${stem}.chunks.json`)
  if (!force && fs.existsSync(chunkPath)) {
    return { stem, status: 'skipped', reason: 'already_chunked' }
  }

  const md = fs.readFileSync(fp, 'utf8')
  let turns = parseTurnsFromMarkdown(md)
  if (turns.length < 2) {
    const fallback = parseSpeakerDialogue(cleanRawTranscript(md))
    turns = fallback.turns.map((t) => ({ speaker: t.speaker, text: t.text }))
  }
  if (turns.length < 2) {
    return { stem, status: 'failed', reason: 'insufficient_turns' }
  }

  const meta = loadMeta(stem)
  const callType = guessCallType(stem, meta)
  const participant = meta?.participant || inferParticipant(turns)
  const personId = String(participant).toLowerCase().replace(/[^\w]+/g, '_')
  const transcriptId = stem.toLowerCase().replace(/[^\w]+/g, '_')

  const pass1 = await chunkTranscriptPass1({
    callType,
    turns,
    intervieweeName: participant,
    personId,
    transcriptId,
  })

  fs.writeFileSync(
    chunkPath,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        stem,
        personId,
        transcriptId,
        callType,
        model: pass1.model,
        chunks: pass1.chunks,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  if (hypothesis) {
    const rows = await interpretChunksPass2({
      chunks: pass1.chunks,
      hypothesisVersion: hypothesis.hypothesisVersion,
      hypothesisText: hypothesis.hypothesisText,
      icpDefinition: hypothesis.icpDefinition,
      dimensionsList: hypothesis.dimensionsList,
    })
    fs.writeFileSync(
      path.join(
        CHUNK_INTERPRETATIONS_DIR,
        `${stem}.${hypothesis.hypothesisVersion}.interpretations.json`,
      ),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          stem,
          hypothesisVersion: hypothesis.hypothesisVersion,
          count: rows.length,
          rows,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
  }

  return { stem, status: 'chunked', count: pass1.chunks.length, interpreted: Boolean(hypothesis) }
}

async function main() {
  ensureDirs()
  loadRepoEnv()
  const { parallel, force, stemFilters } = parseArgs(process.argv.slice(2))
  const files = []
  walkMarkdown(PRESENTATIONS_DIR, files)
  const targets = files.filter((fp) => {
    const stem = path.basename(fp, '.md').toLowerCase()
    return stemFilters.length === 0 || stemFilters.includes(stem)
  })
  const hypothesis = getHypothesisConfigFromEnv()
  const failures = []
  let skipped = 0
  let chunked = 0
  let interpreted = 0

  console.log(`Parallel workers: ${parallel}`)
  console.log(`Force re-chunk: ${force ? 'yes' : 'no'}`)

  const queue = [...targets]
  const workers = Array.from({ length: Math.max(1, parallel) }, () =>
    (async () => {
      while (queue.length > 0) {
        const fp = queue.shift()
        if (!fp) break
        const stem = path.basename(fp, '.md')
        console.log(`processing: ${stem}`)
        try {
          const result = await processTranscript(fp, hypothesis, force)
          if (result.status === 'skipped') {
            skipped++
            console.log(`skipped: ${stem} (${result.reason})`)
            continue
          }
          if (result.status === 'chunked') {
            chunked++
            if (result.interpreted) interpreted++
            console.log(`chunked: ${stem} (${result.count})`)
            continue
          }
          failures.push({ stem, reason: result.reason || 'unknown' })
        } catch (e) {
          failures.push({ stem, reason: e instanceof Error ? e.message : String(e) })
        }
      }
    })(),
  )

  await Promise.all(workers)

  console.log(`\nProcessed: ${targets.length}`)
  console.log(`Chunked: ${chunked}`)
  console.log(`Interpreted: ${interpreted}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Failed: ${failures.length}`)
  if (failures.length) {
    console.log(JSON.stringify({ failures }, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
