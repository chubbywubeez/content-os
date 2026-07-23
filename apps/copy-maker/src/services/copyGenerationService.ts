import type { CopyMakerInputs } from '../types/copyMaker'
import type { CopyModelId } from '../config/modelProviders'
import {
  openRouterCopyModelForGlm,
  openRouterCopyModelForGemini,
  openRouterCopyModelForKimiK3,
  openRouterCopyModelForMimoPro,
  openRouterCopyModelForOpenAiOption,
  openRouterCopyModelForOpus,
  openRouterCopyModelForOpus48,
} from '../config/modelProviders'
import {
  buildCopyPrompt,
  DEFAULT_COPY_PROMPT_TEMPLATE,
  NO_EM_DASH_COPY_RULE,
} from './copyPromptBuilder'
import { fetchPipelinePromptMap } from './pipelinePromptsClient'
import {
  openRouterChatNonStream,
  streamOpenRouterCopyJson,
} from './openRouterCopyStream'

/** Same system line for every OpenRouter copy call so the JSON `body` contract stays identical. */
const COPY_SYSTEM_TEXT_DEFAULT =
  `You write high-signal social posts. Output valid JSON only matching the schema in the user message. ${NO_EM_DASH_COPY_RULE}`

const REFINE_SYSTEM_DEFAULT =
  `You revise social posts. Return only the revised post text. No JSON, no markdown code fences. ${NO_EM_DASH_COPY_RULE}`

const MOJIBAKE_EM_DASH = '\u00e2\u20ac\u201d'

function appendNoEmDashRule(text: string): string {
  const trimmed = text.trim()
  if (trimmed.includes(NO_EM_DASH_COPY_RULE)) return trimmed
  return `${trimmed}\n\nHard formatting rule:\n- ${NO_EM_DASH_COPY_RULE}`
}

function sanitizeGeneratedCopy(text: string): string {
  return text
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(new RegExp(`\\s*${MOJIBAKE_EM_DASH}\\s*`, 'g'), ', ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/,\s*([.!?])/g, '$1')
    .trim()
}

async function buildCopyPromptWithOverrides(inputs: CopyMakerInputs): Promise<{
  systemText: string
  userPrompt: string
  refineSystemText: string
}> {
  try {
    const map = await fetchPipelinePromptMap()
    const template = map.content_os_generate_copy_user_template || DEFAULT_COPY_PROMPT_TEMPLATE
    const outputContract =
      map.content_os_generate_copy_output_contract ||
      `OUTPUT FORMAT (strict JSON only, no markdown fences):\n{\n  "body": "full post text with appropriate line breaks and no em dashes"\n}`
    const topicInstruction =
      map.content_os_topic_instruction || 'The TOPIC is the central subject. Everything must serve the topic.'
    const personaInstruction =
      map.content_os_customer_persona_instruction ||
      'Write for the CUSTOMER PERSONA (full persona text below).'
    const voiceInstruction =
      map.content_os_writer_voice_instruction || 'Use the WRITER VOICE document as how it should sound.'
    const styleInstruction =
      map.content_os_style_guide_instruction ||
      'Treat the STYLE GUIDE as hard constraints (tone, taboos, formatting).'
    const frameworkInstruction =
      map.content_os_writing_framework_instruction ||
      'Follow the WRITING FRAMEWORK section for structure / pattern.'

    const userPrompt = appendNoEmDashRule(
      buildCopyPrompt(inputs, {
        template,
        outputContract,
        topicInstruction,
        personaInstruction,
        voiceInstruction,
        styleGuideInstruction: styleInstruction,
        writingFrameworkInstruction: frameworkInstruction,
      }),
    )

    return {
      systemText: appendNoEmDashRule(map.content_os_generate_copy_system || COPY_SYSTEM_TEXT_DEFAULT),
      userPrompt,
      refineSystemText: appendNoEmDashRule(map.content_os_final_post_refine_system || REFINE_SYSTEM_DEFAULT),
    }
  } catch {
    return {
      systemText: appendNoEmDashRule(COPY_SYSTEM_TEXT_DEFAULT),
      userPrompt: appendNoEmDashRule(buildCopyPrompt(inputs)),
      refineSystemText: appendNoEmDashRule(REFINE_SYSTEM_DEFAULT),
    }
  }
}

function openRouterModelForCopyModelId(id: CopyModelId): string {
  if (id === 'opus-4-8') return openRouterCopyModelForOpus48()
  if (id === 'opus-4-7') return openRouterCopyModelForOpus()
  if (id === 'openai-5-5') return openRouterCopyModelForOpenAiOption()
  if (id === 'glm-5-2') return openRouterCopyModelForGlm()
  if (id === 'mimo-v2-5-pro') return openRouterCopyModelForMimoPro()
  if (id === 'kimi-k3') return openRouterCopyModelForKimiK3()
  return openRouterCopyModelForGemini()
}

function mockGeneratedPost(topic: string): string {
  const t = topic.trim() || 'your topic'
  const i = t.length % 3
  const blocks = [
    `Here is the blunt version on ${t}:\n\nMost advice here is too polite to work. Pick one constraint, ship the smallest test, measure what actually moved the outcome.\n\nIf you want a thread, say "thread" and I will outline it.`,
    `I used to over-explain ${t}.\n\nI would write paragraphs of context because I was afraid of being wrong. The posts that worked were the ones with one scene, one tension, one takeaway.\n\nTell me what changed for you—if this resonates, I will share the checklist I use before I hit publish.`,
    `Hot take: ${t} does not fail because of talent.\n\nIt fails because people optimize for sounding smart instead of being clear.\n\nClear beats clever. Specific beats inspirational.`,
  ]
  return blocks[i] ?? blocks[0]!
}

function parseGeneratedPostFromContent(content: string): string | null {
  const trimmed = content.trim()
  const jsonLike = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  try {
    const parsed = JSON.parse(jsonLike) as { body?: unknown; options?: unknown[] }
    if (typeof parsed.body === 'string' && parsed.body.trim()) return sanitizeGeneratedCopy(parsed.body)
    if (Array.isArray(parsed.options) && parsed.options.length > 0) {
      const row = parsed.options[0] as { body?: string }
      if (typeof row.body === 'string' && row.body.trim()) return sanitizeGeneratedCopy(row.body)
    }
  } catch {
    return null
  }
  return null
}

/**
 * Streamed copy: always OpenRouter (`OPENROUTER_API_KEY` on the server). No client-side API keys.
 */
export async function generateCopyStreaming(
  inputs: CopyMakerInputs,
  onRawAccumulated: (raw: string) => void,
  options: { copyModelId: CopyModelId },
): Promise<string> {
  const { userPrompt, systemText } = await buildCopyPromptWithOverrides(inputs)
  const model = openRouterModelForCopyModelId(options.copyModelId)

  try {
    const raw = await streamOpenRouterCopyJson({
      model,
      systemText,
      userText: userPrompt,
      onRawAccumulated,
    })
    const parsed = parseGeneratedPostFromContent(raw)
    if (parsed) return parsed
  } catch (e) {
    console.warn('[OpenRouter copy stream]', e)
  }

  const mock = mockGeneratedPost(inputs.topic.description)
  const sanitizedMock = sanitizeGeneratedCopy(mock)
  onRawAccumulated(JSON.stringify({ body: sanitizedMock }, null, 2))
  return sanitizedMock
}

/**
 * Non-streaming copy (same OpenRouter path). Defaults to the “Gemini” OpenRouter slug if you omit `copyModelId`.
 */
export async function generateCopy(
  inputs: CopyMakerInputs,
  options?: { copyModelId: CopyModelId },
): Promise<string> {
  const { userPrompt, systemText } = await buildCopyPromptWithOverrides(inputs)
  const model = openRouterModelForCopyModelId(options?.copyModelId ?? 'gemini')

  try {
    const text = await openRouterChatNonStream({
      model,
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    })
    const parsed = parseGeneratedPostFromContent(text)
    if (parsed) return parsed
  } catch (e) {
    console.warn('[OpenRouter copy]', e)
  }

  return sanitizeGeneratedCopy(mockGeneratedPost(inputs.topic.description))
}

/**
 * Post refinements via OpenRouter (plain text back, not JSON).
 */
export async function refinePostCopy(params: {
  baseText: string
  instruction: 'shorter' | 'sharper' | 'addCta'
  cta?: string
}): Promise<string> {
  const { baseText, instruction, cta } = params
  const basePost = sanitizeGeneratedCopy(baseText)

  const instr =
    instruction === 'shorter'
      ? 'Rewrite shorter with no loss of specificity. Keep line breaks tasteful for social.'
      : instruction === 'sharper'
        ? 'Rewrite with sharper claims and tighter sentences. Still truthful and not mean-spirited.'
        : `Naturally weave in this CTA if it fits (otherwise close with a single clear next step): ${cta || '(none provided)'}`

  let refineSystemText = REFINE_SYSTEM_DEFAULT
  try {
    const map = await fetchPipelinePromptMap()
    refineSystemText = appendNoEmDashRule(map.content_os_final_post_refine_system || REFINE_SYSTEM_DEFAULT)
  } catch {
    // Keep default refine system.
  }

  try {
    const out = await openRouterChatNonStream({
      model: openRouterCopyModelForGemini(),
      messages: [
        { role: 'system', content: refineSystemText },
        { role: 'user', content: `Instruction: ${instr}\n\nPOST:\n${basePost}` },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    })
    if (out.trim()) return sanitizeGeneratedCopy(out)
  } catch (e) {
    console.warn('[OpenRouter refine]', e)
  }

  if (instruction === 'shorter') return sanitizeGeneratedCopy(basePost.split('\n').slice(0, 4).join('\n'))
  if (instruction === 'sharper') {
    return sanitizeGeneratedCopy(`${basePost}\n\nBottom line: say the quiet part out loud, then give the next step.`)
  }
  return sanitizeGeneratedCopy(cta ? `${basePost}\n\n${cta}` : basePost)
}
