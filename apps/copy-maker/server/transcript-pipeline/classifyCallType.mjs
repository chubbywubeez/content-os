import { openRouterChat } from './openRouter.mjs'
import { parseSpeakerDialogue, inferIntervieweeHint } from './parseSpeakers.mjs'
import { detectCallMode } from './relabelSpeakers.mjs'

/** @typedef {'interview' | 'demo'} CallType */
/** @typedef {'two' | 'three'} SpeakerMode */

const JUNK_SPEAKER = /unidentified|unknown|note\s*taker|notetaker/i
export const DEFAULT_CLASSIFY_CALL_SYSTEM = `You classify Vantum customer call transcripts.

**interview** — Problem discovery: Tabarak (CEO) explores a fractional operator's pain. No full product UI walkthrough. Usually 2 speakers (Tabarak + interviewee). Sometimes says "Connect" in title.

**demo** — Product demonstration: Brian (CTO) walks through Vantum screens; Tabarak may bridge to prior problem interview; customer reacts. Usually 3 speakers (Brian, Tabarak, customer). Look for "let me show you", feature names, UI language.

Output JSON only:
{
  "callType": "interview" | "demo",
  "speakerMode": "two" | "three",
  "confidence": number,
  "rationale": "one sentence"
}`

/**
 * Fast heuristic before optional LLM tie-break.
 * @param {{ parsed: ReturnType<typeof parseSpeakerDialogue>, cleaned: string }} input
 */
export function heuristicCallType(input) {
  const speakerMode = detectCallMode(input)
  const real = input.parsed.speakers.filter((s) => !JUNK_SPEAKER.test(s))
  const blob = `${input.parsed.title}\n${input.cleaned.slice(0, 4000)}`.toLowerCase()
  const titleDemo = /\b(demo|product demo|walkthrough|product tour|screen share)\b/.test(blob)
  const titleInterview = /\b(problem|connect|discovery|interview)\b/.test(blob)

  let callType = speakerMode === 'three' ? 'demo' : 'interview'
  if (titleDemo && !titleInterview) callType = 'demo'
  if (titleInterview && speakerMode === 'two' && !titleDemo) callType = 'interview'
  if (real.length >= 3) callType = 'demo'

  let confidence = 0.72
  if (speakerMode === 'three' && callType === 'demo') confidence = 0.88
  if (speakerMode === 'two' && callType === 'interview' && titleInterview) confidence = 0.9
  if (speakerMode === 'two' && callType === 'demo') confidence = 0.45
  if (speakerMode === 'three' && callType === 'interview') confidence = 0.4

  return {
    callType,
    speakerMode,
    confidence,
    rationale: `Heuristic: ${real.length} speakers, mode=${speakerMode}, title signals.`,
    source: 'heuristic',
  }
}

/**
 * LLM classification for ambiguous calls (2-person demo or mis-labeled 3-person).
 * @param {{ cleaned: string, parsed: ReturnType<typeof parseSpeakerDialogue>, heuristic: ReturnType<typeof heuristicCallType> }} input
 */
async function classifyCallTypeWithLlm(input, prompts = {}) {
  const system = prompts.classify_call_system || DEFAULT_CLASSIFY_CALL_SYSTEM

  const user = [
    `Heuristic guess: ${input.heuristic.callType} (${Math.round(input.heuristic.confidence * 100)}%)`,
    `Speakers detected: ${input.parsed.speakers.join(', ')}`,
    `Title: ${input.parsed.title}`,
    '',
    '--- TRANSCRIPT EXCERPT ---',
    input.cleaned.slice(0, 24_000),
  ].join('\n')

  const { text, model } = await openRouterChat({
    system,
    user,
    temperature: 0.1,
    max_tokens: 512,
    timeoutMs: 60_000,
  })

  const jsonLike = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const data = JSON.parse(jsonLike)
  const callType = String(data.callType || '').toLowerCase()
  const speakerMode = String(data.speakerMode || '').toLowerCase()
  if (callType !== 'interview' && callType !== 'demo') {
    throw new Error(`Invalid callType: ${data.callType}`)
  }
  return {
    callType,
    speakerMode: speakerMode === 'three' ? 'three' : 'two',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.75,
    rationale: String(data.rationale || ''),
    source: 'llm',
    model,
  }
}

/**
 * Classify interview vs product demo (pipeline step).
 * @param {string} cleaned
 */
export async function classifyCallType(cleaned, prompts = {}) {
  const parsed = parseSpeakerDialogue(cleaned)
  const intervieweeHint = inferIntervieweeHint(parsed)
  const heuristic = heuristicCallType({ parsed, cleaned })

  const needsLlm =
    heuristic.confidence < 0.82 ||
    (heuristic.speakerMode === 'two' && heuristic.callType === 'demo') ||
    (heuristic.speakerMode === 'three' && heuristic.callType === 'interview')

  if (!needsLlm) {
    return { parsed, intervieweeHint, ...heuristic }
  }

  try {
    const llm = await classifyCallTypeWithLlm({ cleaned, parsed, heuristic }, prompts)
    return { parsed, intervieweeHint, ...llm }
  } catch {
    return { parsed, intervieweeHint, ...heuristic }
  }
}

/**
 * @param {CallType} callType
 */
export function callTypeToSpeakerMode(callType, speakerMode) {
  if (speakerMode === 'two' || speakerMode === 'three') return speakerMode
  return callType === 'demo' ? 'three' : 'two'
}
