import { chunkTranscriptPass1, interpretChunksPass2 } from './chunking.mjs'
import {
  fetchActiveHypothesisContext,
  getSupabasePipelineClient,
  insertChunkRows,
  insertInterpretationRows,
} from './supabasePipelineStore.mjs'

function parseTurnsFromMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
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

function participantFromTurns(turns, fallback = 'Participant') {
  const counts = new Map()
  for (const t of turns) {
    const name = String(t.speaker || '')
    if (/^(brian|tabarak)$/i.test(name)) continue
    counts.set(name, (counts.get(name) || 0) + String(t.text || '').length)
  }
  let best = fallback
  let bestLen = 0
  for (const [speaker, len] of counts.entries()) {
    if (len > bestLen) {
      bestLen = len
      best = speaker
    }
  }
  return best || fallback
}

async function main() {
  const supabase = getSupabasePipelineClient()
  if (!supabase) throw new Error('Supabase client unavailable. Check .env keys.')

  const shouldInterpret = process.env.RUN_INTERPRETATIONS === '1'
  const onlyInterpret = process.env.ONLY_INTERPRET === '1'
  const interpretOffset = Math.max(0, Number(process.env.INTERPRET_OFFSET || 0))
  const interpretLimit = Math.max(1, Number(process.env.INTERPRET_LIMIT || 99999))
  const hypothesis = shouldInterpret ? await fetchActiveHypothesisContext() : null
  if (shouldInterpret && !hypothesis) {
    throw new Error('No active hypothesis found in plans table. Add one active plan first.')
  }

  const { data: transcripts, error: tErr } = await supabase
    .from('transcripts')
    .select('id, person_id, transcript_text, interview_type')
    .order('id', { ascending: true })
  if (tErr) throw new Error(`transcripts query failed: ${tErr.message}`)

  const { data: people, error: pErr } = await supabase.from('people').select('id, name')
  if (pErr) throw new Error(`people query failed: ${pErr.message}`)
  const personNameById = new Map((people || []).map((p) => [p.id, p.name]))

  const { data: allChunks, error: cErr } = await supabase
    .from('chunks')
    .select('id, transcript_id, chunk_order, speaker, raw_text, interview_type, topic, subtopic, emotion, is_quote_worthy, temporal_status, reaction_intensity, chunk_mode, self_disqualification, competitive_product, competitive_sentiment, referral_signal, referral_target, adoption_barrier, quote_attribution, pricing_insight, feature_discussed, feature_reaction, objection_type, feedback_type, need_type')
  if (cErr) throw new Error(`chunks query failed: ${cErr.message}`)
  const chunksByTranscript = new Map()
  for (const ch of allChunks || []) {
    const arr = chunksByTranscript.get(ch.transcript_id) || []
    arr.push(ch)
    chunksByTranscript.set(ch.transcript_id, arr)
  }

  const hasInterpByChunkId = new Set()
  if (shouldInterpret && hypothesis) {
    const { data: allInterp, error: iErr } = await supabase
      .from('chunk_interpretations')
      .select('id, chunk_id, hypothesis_version')
      .eq('hypothesis_version', hypothesis.hypothesisVersion)
    if (iErr) throw new Error(`chunk_interpretations query failed: ${iErr.message}`)
    for (const row of allInterp || []) hasInterpByChunkId.add(row.chunk_id)
  }

  let chunkedTranscripts = 0
  let insertedChunksTotal = 0
  let interpretedTranscripts = 0
  let insertedInterpretationsTotal = 0
  let interpretationCandidatesSeen = 0

  for (const tx of transcripts || []) {
    const personName = personNameById.get(tx.person_id) || `person_${tx.person_id}`
    let dbChunks = chunksByTranscript.get(tx.id) || []

    if (!onlyInterpret && dbChunks.length === 0) {
      console.log(`chunking transcript ${tx.id}...`)
      const turns = parseTurnsFromMarkdown(tx.transcript_text)
      if (turns.length > 1) {
        const pass1 = await chunkTranscriptPass1({
          callType: tx.interview_type === 'demo' ? 'demo' : 'interview',
          turns,
          intervieweeName: participantFromTurns(turns, personName),
          personId: String(tx.person_id),
          transcriptId: String(tx.id),
        })
        dbChunks = await insertChunkRows({
          personId: tx.person_id,
          transcriptId: tx.id,
          chunks: pass1.chunks,
        })
        chunksByTranscript.set(tx.id, dbChunks)
        chunkedTranscripts += 1
        insertedChunksTotal += dbChunks.length
        console.log(`chunked transcript ${tx.id}: ${dbChunks.length} chunks`)
      }
    }

    if (dbChunks.length === 0) continue
    if (!shouldInterpret) continue
    const missingForTranscript = dbChunks.filter((c) => !hasInterpByChunkId.has(c.id))
    if (missingForTranscript.length === 0) continue
    interpretationCandidatesSeen += 1
    if (interpretationCandidatesSeen <= interpretOffset) continue
    if (interpretedTranscripts >= interpretLimit) continue
    console.log(`interpreting transcript ${tx.id} (${missingForTranscript.length} missing) ...`)

    const pass2InputChunks = dbChunks
      .sort((a, b) => Number(a.chunk_order || 0) - Number(b.chunk_order || 0))
      .map((c) => ({
        chunk_id: `${tx.id}_c${c.chunk_order}`,
        speaker: c.speaker,
        topic: c.topic,
        raw_text: c.raw_text,
        chunk_mode: c.chunk_mode,
        interview_type: c.interview_type,
        feature_discussed: c.feature_discussed,
      }))

    const rows = await interpretChunksPass2({
      chunks: pass2InputChunks,
      hypothesisVersion: hypothesis.hypothesisVersion,
      hypothesisText: hypothesis.hypothesisText,
      icpDefinition: hypothesis.icpDefinition,
      dimensionsList: hypothesis.dimensionsList,
    })

    const chunkIdByOrder = new Map(dbChunks.map((c) => [Number(c.chunk_order), c.id]))
    const inserted = await insertInterpretationRows({
      chunkIdByOrder,
      rows,
      hypothesisVersion: hypothesis.hypothesisVersion,
    })
    interpretedTranscripts += 1
    insertedInterpretationsTotal += inserted
    console.log(`interpreted transcript ${tx.id}: ${inserted} rows`)
    for (const c of dbChunks) hasInterpByChunkId.add(c.id)
  }

  console.log(
    JSON.stringify(
      {
        hypothesisVersion: hypothesis?.hypothesisVersion ?? null,
        runInterpretations: shouldInterpret,
        onlyInterpret,
        interpretOffset,
        interpretLimit,
        interpretationCandidatesSeen,
        chunkedTranscripts,
        insertedChunksTotal,
        interpretedTranscripts,
        insertedInterpretationsTotal,
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
