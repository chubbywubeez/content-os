import fs from 'node:fs'
import {
  SKILL_TRANSCRIPT_TWO,
  SKILL_TRANSCRIPT_THREE,
} from './paths.mjs'
import { openRouterChat } from './openRouter.mjs'
import { parseSpeakerDialogue, inferIntervieweeHint } from './parseSpeakers.mjs'

/** @typedef {'two' | 'three'} CallMode */

const JUNK_SPEAKER = /unidentified|unknown|note\s*taker|notetaker/i

/**
 * Route to 2-person problem interview vs 3-person demo cleaning prompt.
 * @param {{ parsed: ReturnType<typeof parseSpeakerDialogue>, cleaned: string }} input
 * @returns {CallMode}
 */
export function detectCallMode({ parsed, cleaned }) {
  const real = parsed.speakers.filter((s) => !JUNK_SPEAKER.test(s))
  const hasBrian = real.some((s) => /\bbrian\b/i.test(s))
  const hasTabarak = real.some((s) => /\b(tabarak|tupac)\b/i.test(s))
  const title = `${parsed.title}\n${cleaned.slice(0, 2000)}`
  const titleDemo = /\b(demo|walkthrough|product\s+tour|screen\s+share)\b/i.test(title)

  if (real.length >= 3) return 'three'
  if (hasBrian && hasTabarak) return 'three'
  if (titleDemo && (hasBrian || hasTabarak)) return 'three'

  return 'two'
}

/**
 * @param {string} skillPath
 * @param {{ intervieweeName: string, intervieweeLabel: string, intervieweeRole: string }} vars
 */
function loadSkillPrompt(skillPath, vars) {
  let text = fs.readFileSync(skillPath, 'utf8')
  // Use body after first heading if file has YAML-style title line
  const body = text.replace(/^#\s+.+\n+/, '').trim()
  return body
    .replaceAll('{{INTERVIEWEE_NAME}}', vars.intervieweeName)
    .replaceAll('{{INTERVIEWEE_LABEL}}', vars.intervieweeLabel.toUpperCase())
    .replaceAll('{{INTERVIEWEE_ROLE}}', vars.intervieweeRole)
}

function renderPromptTemplate(template, vars) {
  const body = String(template || '')
    .replace(/^#\s+.+\n+/, '')
    .trim()
  return body
    .replaceAll('{{INTERVIEWEE_NAME}}', vars.intervieweeName)
    .replaceAll('{{INTERVIEWEE_LABEL}}', vars.intervieweeLabel.toUpperCase())
    .replaceAll('{{INTERVIEWEE_ROLE}}', vars.intervieweeRole)
}

/**
 * @param {string} name
 */
function toSpeakerLabel(name) {
  const trimmed = name.trim()
  if (!trimmed) return 'PARTICIPANT'
  const first = trimmed.split(/\s+/)[0] ?? trimmed
  return first.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * LLM relabel using Skills/Transcript_Clean_* prompts.
 * @param {{ cleaned: string, mode: CallMode, intervieweeHint: string }} input
 */
export async function relabelSpeakersWithLlm(input, prompts = {}) {
  const intervieweeName = input.intervieweeHint || 'Participant'
  const intervieweeLabel = toSpeakerLabel(intervieweeName)
  const vars = {
    intervieweeName,
    intervieweeLabel,
    intervieweeRole: 'operator',
  }

  const skillPath = input.mode === 'three' ? SKILL_TRANSCRIPT_THREE : SKILL_TRANSCRIPT_TWO
  const promptOverride =
    input.mode === 'three' ? prompts.relabel_three_system : prompts.relabel_two_system
  const system = promptOverride
    ? renderPromptTemplate(promptOverride, vars)
    : loadSkillPrompt(skillPath, vars)

  const user = [
    `Call type: ${input.mode === 'three' ? 'three-person product demo' : 'two-person problem interview'}.`,
    `Interviewee name hint: ${intervieweeName}`,
    '',
    '--- RAW TRANSCRIPT (speaker labels may be wrong) ---',
    input.cleaned,
  ].join('\n')

  const { text, model } = await openRouterChat({
    system,
    user,
    temperature: 0.1,
    max_tokens: 24_000,
    timeoutMs: 900_000,
  })

  return {
    labeledText: stripFences(text),
    model,
    mode: input.mode,
    intervieweeLabel,
    intervieweeName,
  }
}

/**
 * @param {string} raw
 */
function stripFences(raw) {
  const t = raw.trim()
  if (t.startsWith('```')) {
    return t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  }
  return t
}

/**
 * Relabel using call-type from classify step.
 * @param {string} cleaned
 * @param {{ speakerMode: import('./classifyCallType.mjs').SpeakerMode, intervieweeHint: string }} opts
 */
export async function relabelSpeakersForCall(cleaned, opts, prompts = {}) {
  const preview = parseSpeakerDialogue(cleaned)
  const mode = opts.speakerMode
  const intervieweeHint = opts.intervieweeHint || inferIntervieweeHint(preview)
  const relabeled = await relabelSpeakersWithLlm({ cleaned, mode, intervieweeHint }, prompts)
  return { preview, ...relabeled }
}

/** @deprecated Use classifyCallType + relabelSpeakersForCall */
export async function detectAndRelabelSpeakers(cleaned) {
  const preview = parseSpeakerDialogue(cleaned)
  const mode = detectCallMode({ parsed: preview, cleaned })
  const intervieweeHint = inferIntervieweeHint(preview)
  return relabelSpeakersForCall(cleaned, { speakerMode: mode, intervieweeHint })
}
