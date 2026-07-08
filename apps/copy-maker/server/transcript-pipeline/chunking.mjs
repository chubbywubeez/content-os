import fs from 'node:fs'
import {
  PROMPT_CHUNK_DEMO,
  PROMPT_CHUNK_PROBLEM,
  PROMPT_HYPOTHESIS_INTERPRETATION,
} from './paths.mjs'
import { openRouterChat } from './openRouter.mjs'

function parseJsonFromModel(text, fallback = 'object') {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const first = fallback === 'array' ? cleaned.indexOf('[') : cleaned.indexOf('{')
    const last = fallback === 'array' ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1))
    }
    throw new Error('Failed to parse model JSON output')
  }
}

async function parseJsonWithRepair(text, fallback = 'object') {
  try {
    return parseJsonFromModel(text, fallback)
  } catch {
    const system = `You repair malformed JSON into strictly valid JSON.
Rules:
- Keep all original keys and values.
- Preserve arrays/objects exactly by intent.
- Return ONLY valid JSON.
- No markdown, no commentary, no backticks.`
    const user = [
      `Expected root type: ${fallback === 'array' ? 'array' : 'object'}`,
      '',
      'Malformed JSON:',
      text,
    ].join('\n')
    const fixed = await openRouterChat({
      system,
      user,
      temperature: 0,
      max_tokens: 8000,
      timeoutMs: 90_000,
    })
    return parseJsonFromModel(fixed.text, fallback)
  }
}

function fillTemplate(template, vars) {
  let out = template
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v ?? ''))
  return out
}

function speakerRoleForChunk(callType, speaker, intervieweeName) {
  const s = String(speaker || '').toLowerCase()
  if (callType === 'demo') {
    if (s.includes('brian') || s === 'presenter') return 'presenter'
    if (s.includes('tabarak') || s === 'interviewer') return 'interviewer'
    if (s.includes(intervieweeName.toLowerCase())) return 'interviewee'
    if (s === 'interviewee') return 'interviewee'
    return 'interviewee'
  }
  if (s.includes('tabarak') || s === 'interviewer') return 'interviewer'
  return 'interviewee'
}

function transcriptForModel(turns) {
  return turns
    .map((t) => `${String(t.speaker || '').toUpperCase()}: ${String(t.text || '').trim()}`)
    .join('\n\n')
}

function splitTurnsIntoBatches(turns, maxChars = 12000) {
  const batches = []
  let current = []
  let currentChars = 0
  for (const t of turns) {
    const text = `${String(t.speaker || '').toUpperCase()}: ${String(t.text || '').trim()}`
    const len = text.length + 2
    if (current.length > 0 && currentChars + len > maxChars) {
      batches.push(current)
      current = []
      currentChars = 0
    }
    current.push(t)
    currentChars += len
  }
  if (current.length > 0) batches.push(current)
  return batches
}

/**
 * @param {{
 *  callType: 'interview'|'demo',
 *  turns: Array<{speaker: string, text: string}>,
 *  intervieweeName: string,
 *  intervieweeRole?: string,
 *  intervieweeSegment?: string,
 *  personId: string,
 *  transcriptId: string
 * }} input
 */
export async function chunkTranscriptPass1(input, prompts = {}) {
  const promptPath = input.callType === 'demo' ? PROMPT_CHUNK_DEMO : PROMPT_CHUNK_PROBLEM
  const promptOverride =
    input.callType === 'demo'
      ? prompts.chunk_demo_system_template
      : prompts.chunk_problem_system_template
  const template = promptOverride ? String(promptOverride) : fs.readFileSync(promptPath, 'utf8')
  const system = fillTemplate(template, {
    name: input.intervieweeName || 'Participant',
    role: input.intervieweeRole || 'Operator',
    segment: input.intervieweeSegment || 'unknown',
    person_id: input.personId,
    transcript_id: input.transcriptId,
  })
  const batches = splitTurnsIntoBatches(input.turns)
  const all = []
  let model = null
  for (let i = 0; i < batches.length; i++) {
    const user = [
      `Interview type: ${input.callType}`,
      `Batch ${i + 1} of ${batches.length}`,
      '',
      'TRANSCRIPT:',
      transcriptForModel(batches[i]),
    ].join('\n')

    const rsp = await openRouterChat({
      system,
      user,
      temperature: 0.1,
      max_tokens: 6000,
      timeoutMs: 120_000,
    })
    model = model || rsp.model
    const parsed = await parseJsonWithRepair(rsp.text, 'object')
    const rawChunks = Array.isArray(parsed?.chunks) ? parsed.chunks : []
    all.push(...rawChunks)
  }

  const chunks = all.map((c, idx) => ({
    chunk_id: `${input.transcriptId}_c${idx + 1}`,
    transcript_id: input.transcriptId,
    person_id: input.personId,
    chunk_order: idx + 1,
    speaker: speakerRoleForChunk(input.callType, c?.speaker, input.intervieweeName || 'Participant'),
    raw_text: String(c?.raw_text || '').trim(),
    interview_type: input.callType === 'demo' ? 'demo' : 'problem',
    topic: c?.topic ?? 'other',
    subtopic: c?.subtopic ?? null,
    emotion: c?.emotion ?? null,
    is_quote_worthy: Boolean(c?.is_quote_worthy),
    temporal_status: c?.temporal_status ?? null,
    reaction_intensity: c?.reaction_intensity ?? null,
    chunk_mode: c?.chunk_mode ?? null,
    self_disqualification: c?.self_disqualification ?? 'none',
    competitive_product: c?.competitive_product ?? null,
    competitive_sentiment: c?.competitive_sentiment ?? null,
    referral_signal: Boolean(c?.referral_signal),
    referral_target: c?.referral_target ?? null,
    adoption_barrier: c?.adoption_barrier ?? null,
    quote_attribution: c?.quote_attribution ?? null,
    pricing_insight: Boolean(c?.pricing_insight),
    feature_discussed: c?.feature_discussed ?? null,
    feature_reaction: c?.feature_reaction ?? null,
    objection_type: c?.objection_type ?? null,
    feedback_type: c?.feedback_type ?? null,
    need_type: c?.need_type ?? 'none',
  }))
  return { chunks, model: model || 'unknown' }
}

export function getHypothesisConfigFromEnv() {
  const hypothesisVersion = String(process.env.VANTUM_HYPOTHESIS_VERSION ?? '').trim()
  const hypothesisText = String(process.env.VANTUM_HYPOTHESIS_TEXT ?? '').trim()
  const icpDefinition = String(process.env.VANTUM_HYPOTHESIS_ICP ?? '').trim()
  const dimensionsList = String(process.env.VANTUM_HYPOTHESIS_DIMENSIONS ?? '').trim()
  if (!hypothesisVersion || !hypothesisText || !icpDefinition || !dimensionsList) return null
  return { hypothesisVersion, hypothesisText, icpDefinition, dimensionsList }
}

/**
 * @param {{
 *  chunks: Array<Record<string, unknown>>,
 *  hypothesisVersion: string,
 *  hypothesisText: string,
 *  icpDefinition: string,
 *  dimensionsList: string
 * }} input
 */
export async function interpretChunksPass2(input, prompts = {}) {
  const template = prompts.interpret_chunks_system_template
    ? String(prompts.interpret_chunks_system_template)
    : fs.readFileSync(PROMPT_HYPOTHESIS_INTERPRETATION, 'utf8')
  const out = []
  const batchSize = 40
  for (let i = 0; i < input.chunks.length; i += batchSize) {
    const batch = input.chunks.slice(i, i + batchSize).map((c) => ({
      id: c.chunk_id,
      speaker: c.speaker,
      topic: c.topic,
      raw_text: c.raw_text,
      chunk_mode: c.chunk_mode,
      interview_type: c.interview_type,
      feature_discussed: c.feature_discussed,
    }))
    const system = fillTemplate(template, {
      hypothesis_version: input.hypothesisVersion,
      hypothesis_text: input.hypothesisText,
      icp_definition: input.icpDefinition,
      dimensions_list: input.dimensionsList,
      chunks_json: JSON.stringify(batch),
    })
    const { text } = await openRouterChat({
      system,
      user: 'Interpret the chunks and return JSON array only.',
      temperature: 0.1,
      max_tokens: 12_000,
      timeoutMs: 180_000,
    })
    const parsed = await parseJsonWithRepair(text, 'array')
    if (!Array.isArray(parsed)) throw new Error('Interpretation output is not an array')
    out.push(...parsed)
  }
  return out
}
