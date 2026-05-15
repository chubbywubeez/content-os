import type { CopyMakerInputs } from '../types/copyMaker'
import type { CopyModelId } from '../config/modelProviders'
import {
  openRouterCopyModelForGemini,
  openRouterCopyModelForOpenAiOption,
  openRouterCopyModelForOpus,
} from '../config/modelProviders'
import { buildCopyPrompt } from './copyPromptBuilder'
import {
  openRouterChatNonStream,
  streamOpenRouterCopyJson,
} from './openRouterCopyStream'

/** Same system line for every OpenRouter copy call so the JSON `body` contract stays identical. */
const COPY_SYSTEM_TEXT =
  'You write high-signal social posts. Output valid JSON only matching the schema in the user message.'

function openRouterModelForCopyModelId(id: CopyModelId): string {
  if (id === 'opus-4-7') return openRouterCopyModelForOpus()
  if (id === 'openai-5-5') return openRouterCopyModelForOpenAiOption()
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
    if (typeof parsed.body === 'string' && parsed.body.trim()) return parsed.body.trim()
    if (Array.isArray(parsed.options) && parsed.options.length > 0) {
      const row = parsed.options[0] as { body?: string }
      if (typeof row.body === 'string' && row.body.trim()) return row.body.trim()
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
  const userPrompt = buildCopyPrompt(inputs)
  const model = openRouterModelForCopyModelId(options.copyModelId)

  try {
    const raw = await streamOpenRouterCopyJson({
      model,
      systemText: COPY_SYSTEM_TEXT,
      userText: userPrompt,
      onRawAccumulated,
    })
    const parsed = parseGeneratedPostFromContent(raw)
    if (parsed) return parsed
  } catch (e) {
    console.warn('[OpenRouter copy stream]', e)
  }

  const mock = mockGeneratedPost(inputs.topic.description)
  onRawAccumulated(JSON.stringify({ body: mock }, null, 2))
  return mock
}

/**
 * Non-streaming copy (same OpenRouter path). Defaults to the “Gemini” OpenRouter slug if you omit `copyModelId`.
 */
export async function generateCopy(
  inputs: CopyMakerInputs,
  options?: { copyModelId: CopyModelId },
): Promise<string> {
  const userPrompt = buildCopyPrompt(inputs)
  const model = openRouterModelForCopyModelId(options?.copyModelId ?? 'gemini')

  try {
    const text = await openRouterChatNonStream({
      model,
      messages: [
        { role: 'system', content: COPY_SYSTEM_TEXT },
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

  return mockGeneratedPost(inputs.topic.description)
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

  const instr =
    instruction === 'shorter'
      ? 'Rewrite shorter with no loss of specificity. Keep line breaks tasteful for social.'
      : instruction === 'sharper'
        ? 'Rewrite with sharper claims and tighter sentences. Still truthful and not mean-spirited.'
        : `Naturally weave in this CTA if it fits (otherwise close with a single clear next step): ${cta || '(none provided)'}`

  const system =
    'You revise social posts. Return only the revised post text. No JSON, no markdown code fences.'

  try {
    const out = await openRouterChatNonStream({
      model: openRouterCopyModelForGemini(),
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Instruction: ${instr}\n\nPOST:\n${baseText}` },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    })
    if (out.trim()) return out.trim()
  } catch (e) {
    console.warn('[OpenRouter refine]', e)
  }

  if (instruction === 'shorter') return baseText.split('\n').slice(0, 4).join('\n')
  if (instruction === 'sharper') return `${baseText}\n\nBottom line: say the quiet part out loud—then give the next step.`
  return cta ? `${baseText}\n\n${cta}` : baseText
}
