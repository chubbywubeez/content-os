import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { REPO_ROOT } from './paths.mjs'

let cachedClient = null

function maybeLoadRepoEnv() {
  const envPath = path.join(REPO_ROOT, '.env')
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

function getEnv(name) {
  const value = String(process.env[name] ?? '').trim()
  return value || null
}

export function getSupabasePipelineClient() {
  if (cachedClient) return cachedClient
  maybeLoadRepoEnv()
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const key =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) return null
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

function stageForCallType(callType) {
  return callType === 'demo' ? 'demo' : 'problem_interview'
}

export async function startProcessingRun({ jobId }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('processing_runs')
    .insert([{ job_id: jobId, status: 'running', steps_completed: '[]' }])
    .select('id')
    .single()
  if (error) throw new Error(`processing_runs insert failed: ${error.message}`)
  return data.id
}

export async function updateProcessingRun(runId, patch) {
  const supabase = getSupabasePipelineClient()
  if (!supabase || !runId) return
  const { error } = await supabase.from('processing_runs').update(patch).eq('id', runId)
  if (error) throw new Error(`processing_runs update failed: ${error.message}`)
}

export async function upsertPersonForPipeline({ participant, callType, personaStage }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return null
  const name = String(participant || '').trim()
  if (!name) return null

  const stage = stageForCallType(callType)
  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  if (findError) throw new Error(`people lookup failed: ${findError.message}`)

  if (existing?.id) {
    const updatePatch = { stage }
    if (personaStage) updatePatch.persona_stage = personaStage
    const { error } = await supabase.from('people').update(updatePatch).eq('id', existing.id)
    if (error) throw new Error(`people update failed: ${error.message}`)
    return existing.id
  }

  const insertPatch = { name, stage, persona_stage: personaStage || null }
  const { data: inserted, error } = await supabase
    .from('people')
    .insert([insertPatch])
    .select('id')
    .single()
  if (error) throw new Error(`people insert failed: ${error.message}`)
  return inserted.id
}

export async function insertTranscriptRow({ personId, transcriptText, callType, speakers }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return null
  const interviewType = callType === 'demo' ? 'demo' : 'problem'
  const { data, error } = await supabase
    .from('transcripts')
    .insert([
      {
        person_id: personId,
        transcript_text: transcriptText,
        interview_type: interviewType,
        speakers,
        is_cleaned: true,
      },
    ])
    .select('id')
    .single()
  if (error) throw new Error(`transcripts insert failed: ${error.message}`)
  return data.id
}

export async function insertChunkRows({ personId, transcriptId, chunks }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return []
  if (!Array.isArray(chunks) || chunks.length === 0) return []
  const payload = chunks.map((c) => ({
    transcript_id: transcriptId,
    person_id: personId,
    chunk_order: c.chunk_order ?? null,
    speaker: c.speaker ?? null,
    raw_text: c.raw_text ?? null,
    interview_type: c.interview_type ?? null,
    topic: c.topic ?? null,
    subtopic: c.subtopic ?? null,
    emotion: c.emotion ?? null,
    is_quote_worthy: Boolean(c.is_quote_worthy),
    temporal_status: c.temporal_status ?? null,
    reaction_intensity: c.reaction_intensity ?? null,
    chunk_mode: c.chunk_mode ?? null,
    self_disqualification: c.self_disqualification ?? 'none',
    competitive_product: c.competitive_product ?? null,
    competitive_sentiment: c.competitive_sentiment ?? null,
    referral_signal: Boolean(c.referral_signal),
    referral_target: c.referral_target ?? null,
    adoption_barrier: c.adoption_barrier ?? null,
    quote_attribution: c.quote_attribution ?? null,
    pricing_insight: Boolean(c.pricing_insight),
    feature_discussed: c.feature_discussed ?? null,
    feature_reaction: c.feature_reaction ?? null,
    objection_type: c.objection_type ?? null,
    feedback_type: c.feedback_type ?? null,
    need_type: c.need_type ?? null,
  }))
  const { data, error } = await supabase
    .from('chunks')
    .insert(payload)
    .select('id, chunk_order, raw_text, emotion')
  if (error) throw new Error(`chunks insert failed: ${error.message}`)
  return Array.isArray(data) ? data : []
}

export async function insertInterpretationRows({ chunkIdByOrder, rows, hypothesisVersion }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return 0
  if (!Array.isArray(rows) || rows.length === 0) return 0

  const payload = []
  for (const row of rows) {
    const idRaw = String(row.id || row.chunk_id || row.chunkId || '')
    const orderMatch = idRaw.match(/_c(\d+)$/)
    const fallbackOrder =
      Number.isFinite(Number(row.chunk_order)) && Number(row.chunk_order) > 0
        ? Number(row.chunk_order)
        : null
    const chunkOrder = orderMatch ? Number(orderMatch[1]) : fallbackOrder
    const chunkId = chunkOrder != null ? chunkIdByOrder.get(chunkOrder) : null
    if (!chunkId) continue
    payload.push({
      chunk_id: chunkId,
      hypothesis_version: hypothesisVersion,
      hypothesis_dimension: row.hypothesis_dimension ?? null,
      evidence_direction: row.evidence_direction ?? null,
      relevance_to_hypothesis: row.relevance_to_hypothesis ?? null,
      feature_request: row.feature_request ?? null,
      feature_maps_to: row.feature_maps_to ?? null,
      fof_diagnostic: row.fof_diagnostic ?? null,
      interview_demo_consistency: row.interview_demo_consistency ?? null,
      interpretation_notes: row.interpretation_notes ?? null,
    })
  }
  if (payload.length === 0) return 0
  const { error } = await supabase.from('chunk_interpretations').insert(payload)
  if (error) throw new Error(`chunk_interpretations insert failed: ${error.message}`)
  return payload.length
}

function scoreRegex(scoreMd, label) {
  const patterns = [
    new RegExp(`${label}\\s*[:\\-]\\s*(\\d+(?:\\.\\d+)?)\\s*(?:\\/\\s*\\d+)?`, 'i'),
    new RegExp(`\\|\\s*${label}\\s*\\|[^\\n]*?\\|\\s*(\\d+(?:\\.\\d+)?)\\s*\\|`, 'i'),
  ]
  for (const rx of patterns) {
    const m = scoreMd.match(rx)
    if (m) return Number(m[1])
  }
  return null
}

function parseScoreDetails(scoreMd, fallbackComposite = null) {
  const oneLine = String(scoreMd || '')
  const classificationMatch =
    oneLine.match(/##\s*CLASSIFICATION\s*\n+\*\*([A-E])\s*[—–-]\s*([^*]+?)\*\*/i) ||
    oneLine.match(/(?:Classification|CLASSIFY)\s*:\s*\*?\*?\s*([A-E])\s*[—–-]?\s*([^\n*]+)/i)
  const classificationLetter = classificationMatch?.[1]?.toUpperCase() ?? null
  const variantMatch = oneLine.match(/(?:Variant|Archetype)\s*:\s*([^\n]+)/i)
  const magicWandMatch = oneLine.match(/(?:Magic\s*Wand|Magic-Wand)[^\n:]*:\s*([^\n]+)/i)
  const summaryMatch = oneLine.match(/(?:One[-\s]*line\s*summary)[^\n:]*:\s*([^\n]+)/i)
  const compositeMatch = oneLine.match(/Composite\s+Score:\s*([\d.]+)\s*\/\s*100/i)

  const h = {}
  const e = {}
  for (const code of ['h1a', 'h1b', 'h1c', 'h1d', 'h1e', 'h1f', 'h1g', 'h1h']) {
    h[code] = scoreRegex(oneLine, code.toUpperCase())
  }
  for (const code of ['e3a', 'e3b', 'e3c', 'e3d']) {
    e[code] = scoreRegex(oneLine, code.toUpperCase())
  }
  const hypothesisTotal = scoreRegex(oneLine, 'Hypothesis\\s*Total')
  const earlyvangelistTotal = scoreRegex(oneLine, 'Earlyvangelist\\s*Total')
  const segmentTotal = scoreRegex(oneLine, 'Segment\\s*Total')
  const commitmentTotal = scoreRegex(oneLine, 'Commitment\\s*Total')
  const composite = compositeMatch ? Number(compositeMatch[1]) : fallbackComposite
  const interviewWeight =
    typeof composite === 'number' && !Number.isNaN(composite)
      ? Math.max(0, Math.min(1, composite / 100))
      : null

  return {
    classification: classificationLetter,
    variant: variantMatch ? variantMatch[1].trim() : null,
    magic_wand: magicWandMatch ? magicWandMatch[1].trim() : null,
    one_line_summary: summaryMatch ? summaryMatch[1].trim() : null,
    composite_score: composite,
    interview_weight: interviewWeight,
    hypothesis_total: hypothesisTotal,
    earlyvangelist_total: earlyvangelistTotal,
    segment_total: segmentTotal,
    commitment_total: commitmentTotal,
    full_narrative: oneLine,
    ...h,
    ...e,
  }
}

export async function writeScoreRow({
  personId,
  transcriptId,
  scoreMd,
  hypothesisVersion,
  fallbackComposite = null,
}) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return null
  const parsed = parseScoreDetails(scoreMd, fallbackComposite)

  const { error: clearErr } = await supabase
    .from('scores')
    .update({ is_current: false })
    .eq('person_id', personId)
    .eq('hypothesis_version', hypothesisVersion)
  if (clearErr) throw new Error(`scores clear-current failed: ${clearErr.message}`)

  const row = {
    person_id: personId,
    transcript_id: transcriptId,
    hypothesis_version: hypothesisVersion,
    is_current: true,
    scored_at: new Date().toISOString(),
    ...parsed,
  }
  const { data, error } = await supabase.from('scores').insert([row]).select('id').single()
  if (error) throw new Error(`scores insert failed: ${error.message}`)
  return data.id
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function findBestChunkForQuote(pullQuote, insertedChunks) {
  const quoteNorm = normalizeText(pullQuote)
  if (!quoteNorm) return null
  const quoteLead = quoteNorm.slice(0, 120)
  for (const c of insertedChunks) {
    const rawNorm = normalizeText(c.raw_text)
    if (!rawNorm) continue
    if (rawNorm.includes(quoteLead) || quoteNorm.includes(rawNorm.slice(0, 120))) {
      return c
    }
  }
  return null
}

export async function insertQuoteRows({
  personId,
  transcriptId,
  personaStage,
  quotesJson,
  insertedChunks,
}) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return 0
  const snippets = Array.isArray(quotesJson?.snippets) ? quotesJson.snippets : []
  if (snippets.length === 0) return 0
  const payload = snippets.map((s) => {
    const match = findBestChunkForQuote(s.pull_quote, insertedChunks)
    return {
      person_id: personId,
      transcript_id: transcriptId,
      chunk_id: match?.id ?? null,
      pull_quote: String(s.pull_quote || '').trim(),
      theme_tag: s.theme_tag ? String(s.theme_tag) : null,
      website_angle: s.website_angle ? String(s.website_angle) : null,
      intensity: Number.isFinite(Number(s.intensity_1_to_5)) ? Number(s.intensity_1_to_5) : null,
      emotion: match?.emotion ?? null,
      persona_stage: personaStage || null,
    }
  })
  const { error } = await supabase.from('quotes').insert(payload)
  if (error) throw new Error(`quotes insert failed: ${error.message}`)
  return payload.length
}

export async function updateQuotePersonaStage({ personId, transcriptId, personaStage }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase || !personaStage) return
  const { error } = await supabase
    .from('quotes')
    .update({ persona_stage: personaStage })
    .eq('person_id', personId)
    .eq('transcript_id', transcriptId)
    .is('persona_stage', null)
  if (error) throw new Error(`quotes persona update failed: ${error.message}`)
}

export async function fetchActiveHypothesisContext() {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return null
  const { data: planRows, error: planErr } = await supabase
    .from('plans')
    .select('id, hypothesis_version, hypothesis_text, icp_definition, predicted_signals')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  if (planErr) throw new Error(`plans query failed: ${planErr.message}`)
  const plan = Array.isArray(planRows) && planRows[0] ? planRows[0] : null
  if (!plan) return null

  const { data: imprintRows, error: imprintErr } = await supabase
    .from('imprints')
    .select('imprint_text, confidence')
    .eq('is_active', true)
    .order('confidence', { ascending: false })
    .limit(50)
  if (imprintErr) throw new Error(`imprints query failed: ${imprintErr.message}`)

  const { data: scoreboardRows, error: scoreErr } = await supabase
    .from('scoreboard')
    .select('*')
    .limit(20)
  if (scoreErr) throw new Error(`scoreboard query failed: ${scoreErr.message}`)

  return {
    hypothesisVersion: String(plan.hypothesis_version || 'v2'),
    hypothesisText: String(plan.hypothesis_text || ''),
    icpDefinition: String(plan.icp_definition || ''),
    dimensionsList: String(plan.predicted_signals || 'h1a, h1b, h1c, h1d, h1e, h1f, h1g, h1h'),
    imprints: Array.isArray(imprintRows) ? imprintRows : [],
    scoreboard: Array.isArray(scoreboardRows) ? scoreboardRows : [],
  }
}
