import fs from 'node:fs'
import path from 'node:path'
import { isVantumSpeaker } from './parseSpeakers.mjs'
import {
  CHUNK_INTERPRETATIONS_DIR,
  CHUNKS_DIR,
  PER_INTERVIEW_DIR,
  PRESENTATIONS_DIR,
  SCORES_DIR,
} from './paths.mjs'
import {
  fetchActiveHypothesisContext,
  getSupabasePipelineClient,
  insertChunkRows,
  insertInterpretationRows,
  insertQuoteRows,
  insertTranscriptRow,
  startProcessingRun,
  updateProcessingRun,
  upsertPersonForPipeline,
  writeScoreRow,
} from './supabasePipelineStore.mjs'

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

function inferParticipant(turns, fallbackStem) {
  const counts = new Map()
  for (const t of turns) {
    if (isVantumSpeaker(t.speaker)) continue
    counts.set(t.speaker, (counts.get(t.speaker) || 0) + t.text.length)
  }
  let best = fallbackStem
  let bestLen = 0
  for (const [speaker, len] of counts.entries()) {
    if (len > bestLen) {
      bestLen = len
      best = speaker
    }
  }
  return best || fallbackStem || 'Participant'
}

function guessCallType(stem) {
  return /\bdemo\b/i.test(stem) ? 'demo' : 'interview'
}

function readJsonIfExists(fp) {
  if (!fs.existsSync(fp)) return null
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'))
  } catch {
    return null
  }
}

function listTranscriptFiles() {
  if (!fs.existsSync(PRESENTATIONS_DIR)) return []
  const out = []
  for (const name of fs.readdirSync(PRESENTATIONS_DIR)) {
    const fp = path.join(PRESENTATIONS_DIR, name)
    const st = fs.statSync(fp)
    if (!st.isFile()) continue
    if (!name.toLowerCase().endsWith('.md')) continue
    if (name === 'ALL_PARSED_INTERVIEWS.md') continue
    out.push(fp)
  }
  out.sort((a, b) => a.localeCompare(b))
  return out
}

async function importOneTranscript(fp, defaultHypothesisVersion) {
  const stem = path.basename(fp, '.md')
  const md = fs.readFileSync(fp, 'utf8')
  const turns = parseTurnsFromMarkdown(md)
  const callType = guessCallType(stem)
  const meta = readJsonIfExists(path.join(PER_INTERVIEW_DIR, `${stem}.meta.json`))
  const persona = meta?.persona ? String(meta.persona).toLowerCase() : null
  const participant = meta?.participant || inferParticipant(turns, stem.replace(/\s+(problem|transcript|meeting|statement)\b.*$/i, '').trim())

  const runId = await startProcessingRun({ jobId: `backfill-${stem.toLowerCase().replace(/[^\w]+/g, '_')}` })
  const steps = []
  const pushStep = async (step) => {
    steps.push(step)
    await updateProcessingRun(runId, { steps_completed: JSON.stringify(steps) })
  }

  let personId = null
  let transcriptId = null
  try {
    personId = await upsertPersonForPipeline({
      participant,
      callType,
      personaStage: persona,
    })
    await pushStep('upsert_person')

    const speakers = [...new Set(turns.map((t) => t.speaker))].join(', ')
    transcriptId = await insertTranscriptRow({
      personId,
      transcriptText: md,
      callType,
      speakers,
    })
    await pushStep('save_transcript')

    let insertedChunks = []
    const chunkDoc = readJsonIfExists(path.join(CHUNKS_DIR, `${stem}.chunks.json`))
    if (chunkDoc?.chunks && Array.isArray(chunkDoc.chunks) && chunkDoc.chunks.length) {
      insertedChunks = await insertChunkRows({
        personId,
        transcriptId,
        chunks: chunkDoc.chunks,
      })
    }
    const chunkIdByOrder = new Map(insertedChunks.map((c) => [c.chunk_order, c.id]))
    await pushStep('chunk_pass1')

    if (fs.existsSync(CHUNK_INTERPRETATIONS_DIR)) {
      const files = fs
        .readdirSync(CHUNK_INTERPRETATIONS_DIR)
        .filter((n) => n.startsWith(`${stem}.`) && n.endsWith('.interpretations.json'))
      for (const file of files) {
        const data = readJsonIfExists(path.join(CHUNK_INTERPRETATIONS_DIR, file))
        const rows = Array.isArray(data?.rows) ? data.rows : []
        if (!rows.length) continue
        const hypothesisVersion =
          (typeof data?.hypothesisVersion === 'string' && data.hypothesisVersion) ||
          file.slice(`${stem}.`.length, -'.interpretations.json'.length)
        await insertInterpretationRows({
          chunkIdByOrder,
          rows,
          hypothesisVersion,
        })
      }
    }
    await pushStep('chunk_pass2')

    if (callType === 'interview') {
      const scorePath = path.join(SCORES_DIR, `${stem}.score.md`)
      if (fs.existsSync(scorePath)) {
        const scoreMd = fs.readFileSync(scorePath, 'utf8')
        await writeScoreRow({
          personId,
          transcriptId,
          scoreMd,
          hypothesisVersion: defaultHypothesisVersion,
          fallbackComposite: null,
        })
      }
    }
    await pushStep('extract_scores')

    const quotesDoc = readJsonIfExists(path.join(PER_INTERVIEW_DIR, `${stem}.json`))
    if (quotesDoc?.snippets && Array.isArray(quotesDoc.snippets) && quotesDoc.snippets.length) {
      await insertQuoteRows({
        personId,
        transcriptId,
        personaStage: persona,
        quotesJson: quotesDoc,
        insertedChunks,
      })
    }
    await pushStep('extract_quotes')

    await updateProcessingRun(runId, {
      person_id: personId,
      transcript_id: transcriptId,
      status: 'complete',
      completed_at: new Date().toISOString(),
      steps_completed: JSON.stringify(steps),
    })

    return {
      stem,
      ok: true,
      personId,
      transcriptId,
      chunkCount: insertedChunks.length,
      quoteCount: Array.isArray(quotesDoc?.snippets) ? quotesDoc.snippets.length : 0,
    }
  } catch (e) {
    await updateProcessingRun(runId, {
      person_id: personId,
      transcript_id: transcriptId,
      status: 'error',
      error_step: steps[steps.length - 1] ?? null,
      error_message: e instanceof Error ? e.message : String(e),
      completed_at: new Date().toISOString(),
      steps_completed: JSON.stringify(steps),
    }).catch(() => {})
    return {
      stem,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function main() {
  const supabase = getSupabasePipelineClient()
  if (!supabase) {
    throw new Error(
      'Supabase not configured. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.',
    )
  }

  const ctx = await fetchActiveHypothesisContext()
  const defaultHypothesisVersion =
    ctx?.hypothesisVersion ||
    String(process.env.VANTUM_HYPOTHESIS_VERSION ?? '').trim() ||
    'v2'

  const files = listTranscriptFiles()
  const results = []
  for (const fp of files) {
    // Skip rollup/system files that are not actual interviews.
    if (path.basename(fp).toLowerCase() === 'mini.md') continue
    // eslint-disable-next-line no-await-in-loop
    const res = await importOneTranscript(fp, defaultHypothesisVersion)
    results.push(res)
    if (res.ok) {
      console.log(`ok: ${res.stem} (chunks=${res.chunkCount}, quotes=${res.quoteCount})`)
    } else {
      console.log(`error: ${res.stem} -> ${res.error}`)
    }
  }

  const ok = results.filter((r) => r.ok).length
  const failed = results.length - ok
  const totalChunks = results.reduce((sum, r) => sum + (r.ok ? r.chunkCount : 0), 0)
  const totalQuotes = results.reduce((sum, r) => sum + (r.ok ? r.quoteCount : 0), 0)
  console.log(
    JSON.stringify(
      {
        scanned: results.length,
        imported: ok,
        failed,
        totalChunks,
        totalQuotes,
        defaultHypothesisVersion,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
