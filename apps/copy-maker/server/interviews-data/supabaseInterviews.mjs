import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(THIS_DIR, '../..')
const REPO_ROOT = path.resolve(APP_ROOT, '../..')

let envLoaded = false
let supabaseClient = null

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return
  const text = fs.readFileSync(fp, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] != null) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function maybeLoadEnv() {
  if (envLoaded) return
  envLoaded = true
  loadEnvFile(path.join(REPO_ROOT, '.env'))
  loadEnvFile(path.join(REPO_ROOT, '.env.local'))
  loadEnvFile(path.join(APP_ROOT, '.env'))
  loadEnvFile(path.join(APP_ROOT, '.env.local'))
}

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) return value
  }
  return ''
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  maybeLoadEnv()
  const url = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'VITE_SUPABASE_ANON_KEY')
  if (!url || !key) return null
  supabaseClient = createClient(url, key, { auth: { persistSession: false } })
  return supabaseClient
}

function normalizePersona(value) {
  const v = String(value || '').toLowerCase()
  if (v === 'tofu' || v === 'mofu' || v === 'bofu') return v
  return null
}

function normalizeCallType(interviewType) {
  const t = String(interviewType || '').toLowerCase()
  return t === 'demo' ? 'demo' : 'interview'
}

function gradeLabel(score, callType) {
  if (callType === 'demo' && !score) return 'Demo'
  const composite = score?.composite_score
  const classification = String(score?.classification || '').trim()
  if (composite != null && !Number.isNaN(Number(composite))) {
    const letter = classification.charAt(0)
    return letter ? `${Number(composite).toFixed(1)} · ${letter}` : Number(composite).toFixed(1)
  }
  if (classification) return classification.split('—')[0]?.trim() || classification
  return callType === 'demo' ? 'Demo' : 'N/C'
}

/**
 * Fallback list for production when `data/presentations` is unavailable.
 * @param {'interview' | 'demo'} callTypeFilter
 */
export async function listCallsFromSupabase(callTypeFilter) {
  const supabase = getSupabaseClient()
  if (!supabase) return []

  const { data: transcripts, error: transcriptsErr } = await supabase
    .from('transcripts')
    .select('id, person_id, interview_type, transcript_text, created_at')
  if (transcriptsErr) throw new Error(`supabase transcripts query failed: ${transcriptsErr.message}`)

  const selected = (transcripts || []).filter((t) => normalizeCallType(t.interview_type) === callTypeFilter)
  if (!selected.length) return []

  const transcriptIds = selected.map((t) => t.id)
  const personIds = [...new Set(selected.map((t) => t.person_id).filter(Boolean))]

  const [{ data: people }, { data: scores }, { data: quotes }] = await Promise.all([
    personIds.length
      ? supabase.from('people').select('id, name, persona_stage').in('id', personIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('scores')
      .select('transcript_id, composite_score, classification, is_current, one_line_summary, full_narrative, scored_at')
      .in('transcript_id', transcriptIds)
      .order('scored_at', { ascending: false }),
    supabase.from('quotes').select('transcript_id').in('transcript_id', transcriptIds),
  ])

  const peopleById = new Map((people || []).map((p) => [p.id, p]))
  const scoreByTranscript = new Map()
  for (const s of scores || []) {
    const key = s.transcript_id
    if (!scoreByTranscript.has(key) || s.is_current) scoreByTranscript.set(key, s)
  }
  const quoteCountByTranscript = new Map()
  for (const q of quotes || []) {
    const key = q.transcript_id
    quoteCountByTranscript.set(key, (quoteCountByTranscript.get(key) || 0) + 1)
  }

  const rows = selected.map((t) => {
    const person = peopleById.get(t.person_id) || null
    const score = scoreByTranscript.get(t.id) || null
    const callType = normalizeCallType(t.interview_type)
    return {
      stem: `db-${t.id}`,
      displayName: String(person?.name || `Interview ${t.id}`),
      callType,
      persona: callType === 'interview' ? normalizePersona(person?.persona_stage) : null,
      grade: gradeLabel(score, callType),
      composite: score?.composite_score != null ? Number(score.composite_score) : null,
      hasTranscript: Boolean(String(t.transcript_text || '').trim()),
      hasQuotes: (quoteCountByTranscript.get(t.id) || 0) > 0,
      hasScore: Boolean(score),
    }
  })

  rows.sort((a, b) => {
    const ac = a.composite ?? -1
    const bc = b.composite ?? -1
    if (bc !== ac) return bc - ac
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })

  return rows
}

/**
 * Fallback detail for synthetic stems like `db-123`.
 * @param {string} stemParam
 */
export async function getInterviewDetailFromSupabase(stemParam) {
  const match = /^db-(\d+)$/.exec(decodeURIComponent(stemParam || ''))
  if (!match) return null
  const transcriptId = Number(match[1])
  if (!Number.isFinite(transcriptId)) return null

  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id, person_id, interview_type, transcript_text')
    .eq('id', transcriptId)
    .maybeSingle()
  if (!transcript) return null

  const [personRes, scoreRes, quotesRes] = await Promise.all([
    transcript.person_id
      ? supabase.from('people').select('id, name, persona_stage').eq('id', transcript.person_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('scores')
      .select('transcript_id, composite_score, classification, one_line_summary, full_narrative, is_current, scored_at')
      .eq('transcript_id', transcriptId)
      .order('is_current', { ascending: false })
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('quotes').select('pull_quote, theme_tag, website_angle, intensity').eq('transcript_id', transcriptId),
  ])

  const person = personRes.data
  const score = scoreRes.data
  const callType = normalizeCallType(transcript.interview_type)
  const composite = score?.composite_score != null ? Number(score.composite_score) : null

  return {
    stem: `db-${transcriptId}`,
    displayName: String(person?.name || `Interview ${transcriptId}`),
    callType,
    persona: callType === 'interview' ? normalizePersona(person?.persona_stage) : null,
    grade: gradeLabel(score, callType),
    composite,
    classification: score?.classification || null,
    hypothesisPct: null,
    summary:
      score?.one_line_summary ||
      score?.full_narrative ||
      String(transcript.transcript_text || '').trim().slice(0, 400) ||
      'No summary available.',
    transcript: transcript.transcript_text
      ? { markdown: transcript.transcript_text, path: `db/transcripts/${transcriptId}` }
      : null,
    score: score
      ? {
          markdown: `# Score\n\n**Classification:** ${score.classification || '—'}\n\n**Composite:** ${composite ?? 'N/C'}`,
          path: `db/scores/${transcriptId}`,
          summary: {
            classification: score.classification || null,
            composite,
            hypothesisPct: null,
          },
        }
      : null,
    quotes: {
      snippets: (quotesRes.data || []).map((q) => ({
        pull_quote: q.pull_quote || '',
        theme_tag: q.theme_tag || '',
        website_angle: q.website_angle || '',
        intensity_1_to_5: q.intensity ?? undefined,
      })),
    },
    meta: {
      callType,
      persona: callType === 'interview' ? normalizePersona(person?.persona_stage) : undefined,
    },
  }
}
