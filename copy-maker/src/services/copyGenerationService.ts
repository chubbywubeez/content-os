import type { CopyMakerInputs } from '../types/copyMaker'
import type { CopyModelId } from '../config/modelProviders'
import { openRouterCopyModelForOpus, openRouterCopyModelForOpenAiOption } from '../config/modelProviders'
import { buildCopyPrompt } from './copyPromptBuilder'
import {
  geminiGenerateContent,
  geminiResponseText,
  geminiApiKeyForBrowser,
  geminiStreamGenerateContent,
  consumeGeminiSseJson,
} from './geminiClient'
import { geminiCopyModelChain } from '../config/geminiCopyModels'
import { streamAnthropicCopyJson, anthropicApiKeyForBrowser } from './anthropicCopyStream'
import { streamOpenAiCopyJson, openaiApiKeyForBrowser } from './openaiCopyStream'
import { streamOpenRouterCopyJson, openRouterApiKeyForBrowser } from './openRouterCopyStream'

/** Same system line for Gemini, Anthropic, and OpenAI so the JSON `body` contract stays identical. */
const COPY_SYSTEM_TEXT =
  'You write high-signal social posts. Output valid JSON only matching the schema in the user message.'

/**
 * Deterministic mock post when offline, missing API key, or parse failure.
 * Keeps the UI usable before wiring production keys.
 */
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

/**
 * Parse a single post from model output. Prefers `{ "body": "..." }`; still accepts legacy
 * `{ "options": [ { "body": "..." } ] }` so older prompts do not brick the UI.
 */
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

/** Run the same request against each model until one returns usable plain text (for refine). */
async function geminiTextWithCopyModelFailover(body: object): Promise<string | null> {
  for (const model of geminiCopyModelChain()) {
    try {
      const res = await geminiGenerateContent(model, body)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        console.warn('[Gemini]', model, res.status, json)
        continue
      }
      const root = json as { promptFeedback?: { blockReason?: string } }
      if (root.promptFeedback?.blockReason) {
        console.warn('[Gemini] promptFeedback', model, root.promptFeedback.blockReason)
        continue
      }
      const text = geminiResponseText(json)
      if (text) return text
      console.warn('[Gemini] empty candidates', model)
    } catch (e) {
      console.warn('[Gemini] request error', model, e)
    }
  }
  return null
}

/** Shared POST body for both one-shot and streaming copy calls. */
function buildCopyGeminiRequestBody(userPrompt: string) {
  return {
    systemInstruction: {
      parts: [{ text: COPY_SYSTEM_TEXT }],
    },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  }
}

/**
 * Stream raw model output (JSON string) so the UI can show tokens as they arrive; returns the same
 * parsed post string when the stream completes. Provider is chosen from `copyModelId`.
 */
export async function generateCopyStreaming(
  inputs: CopyMakerInputs,
  onRawAccumulated: (raw: string) => void,
  options: { copyModelId: CopyModelId },
): Promise<string> {
  const userPrompt = buildCopyPrompt(inputs)
  const { copyModelId } = options

  if (copyModelId === 'opus-4-7') {
    // Prefer OpenRouter (one `VITE_OPENROUTER_API_KEY` on Railway). Fall back to direct Anthropic if you still set that key.
    const prodMissingOpusCred =
      !import.meta.env.DEV &&
      !openRouterApiKeyForBrowser() &&
      !anthropicApiKeyForBrowser()
    if (prodMissingOpusCred) {
      throw new Error(
        'Opus copy needs VITE_OPENROUTER_API_KEY on Railway (recommended). Optional legacy: VITE_ANTHROPIC_API_KEY for direct Anthropic. Local dev: OPENROUTER_API_KEY or ANTHROPIC_API_KEY in repo-root `.env` for the Vite proxy.',
      )
    }

    const tryOpenRouterFirst = import.meta.env.DEV || openRouterApiKeyForBrowser()
    if (tryOpenRouterFirst) {
      try {
        const raw = await streamOpenRouterCopyJson({
          model: openRouterCopyModelForOpus(),
          systemText: COPY_SYSTEM_TEXT,
          userText: userPrompt,
          onRawAccumulated,
        })
        const parsed = parseGeneratedPostFromContent(raw)
        if (parsed) return parsed
      } catch (e) {
        console.warn('[OpenRouter opus copy stream]', e)
      }
    }

    if (import.meta.env.DEV || anthropicApiKeyForBrowser()) {
      try {
        const raw = await streamAnthropicCopyJson({
          systemText: COPY_SYSTEM_TEXT,
          userText: userPrompt,
          onRawAccumulated,
        })
        const parsed = parseGeneratedPostFromContent(raw)
        if (parsed) return parsed
      } catch (e) {
        console.warn('[Anthropic copy stream]', e)
      }
    }
    const mock = mockGeneratedPost(inputs.topic.description)
    onRawAccumulated(JSON.stringify({ body: mock }, null, 2))
    return mock
  }

  if (copyModelId === 'openai-5-5') {
    const prodMissingOpenAiCred =
      !import.meta.env.DEV &&
      !openRouterApiKeyForBrowser() &&
      !openaiApiKeyForBrowser()
    if (prodMissingOpenAiCred) {
      throw new Error(
        'GPT copy needs VITE_OPENROUTER_API_KEY on Railway (recommended). Optional legacy: VITE_OPENAI_API_KEY for direct OpenAI. Local dev: OPENROUTER_API_KEY or OPENAI_API_KEY in repo-root `.env` for the Vite proxy.',
      )
    }

    const tryOpenRouterFirstGpt = import.meta.env.DEV || openRouterApiKeyForBrowser()
    if (tryOpenRouterFirstGpt) {
      try {
        const raw = await streamOpenRouterCopyJson({
          model: openRouterCopyModelForOpenAiOption(),
          systemText: COPY_SYSTEM_TEXT,
          userText: userPrompt,
          onRawAccumulated,
        })
        const parsed = parseGeneratedPostFromContent(raw)
        if (parsed) return parsed
      } catch (e) {
        console.warn('[OpenRouter GPT copy stream]', e)
      }
    }

    if (import.meta.env.DEV || openaiApiKeyForBrowser()) {
      try {
        const raw = await streamOpenAiCopyJson({
          systemText: COPY_SYSTEM_TEXT,
          userText: userPrompt,
          onRawAccumulated,
        })
        const parsed = parseGeneratedPostFromContent(raw)
        if (parsed) return parsed
      } catch (e) {
        console.warn('[OpenAI copy stream]', e)
      }
    }
    const mock = mockGeneratedPost(inputs.topic.description)
    onRawAccumulated(JSON.stringify({ body: mock }, null, 2))
    return mock
  }

  // --- Gemini (default) ---
  if (!import.meta.env.DEV && !geminiApiKeyForBrowser()) {
    const mock = mockGeneratedPost(inputs.topic.description)
    onRawAccumulated(JSON.stringify({ body: mock }, null, 2))
    return mock
  }

  const body = buildCopyGeminiRequestBody(userPrompt)

  const chain = geminiCopyModelChain()
  for (let mi = 0; mi < chain.length; mi++) {
    const model = chain[mi]!
    if (mi > 0) onRawAccumulated('')

    try {
      const res = await geminiStreamGenerateContent(model, body)
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.warn('[Gemini copy stream]', model, res.status, errText.slice(0, 400))
        continue
      }

      let accumulated = ''
      let blocked = false
      await consumeGeminiSseJson(res, (obj) => {
        const root = obj as { promptFeedback?: { blockReason?: string } }
        if (root.promptFeedback?.blockReason) {
          blocked = true
          console.warn('[Gemini copy stream] promptFeedback', model, root.promptFeedback.blockReason)
          return
        }
        const piece = geminiResponseText(obj)
        if (piece) {
          accumulated += piece
          onRawAccumulated(accumulated)
        }
      })

      if (blocked) continue
      if (!accumulated.trim()) {
        console.warn('[Gemini copy stream] empty stream', model)
        continue
      }
      const parsed = parseGeneratedPostFromContent(accumulated)
      if (parsed) return parsed
      console.warn('[Gemini copy stream] output was not valid JSON with a body field; trying fallback model', model)
    } catch (e) {
      console.warn('[Gemini copy stream] request error', model, e)
    }
  }

  const mock = mockGeneratedPost(inputs.topic.description)
  onRawAccumulated(JSON.stringify({ body: mock }, null, 2))
  return mock
}

/**
 * LinkedIn copy via Gemini only: `gemini-3-pro-preview` first, then `gemini-2.5-flash` (configurable).
 * Production needs `VITE_GEMINI_API_KEY` (or alias); dev can use repo-root `GEMINI_API_KEY` via the Vite proxy.
 * Non-streaming fallback (e.g. callers that do not need live tokens).
 */
export async function generateCopy(inputs: CopyMakerInputs): Promise<string> {
  const userPrompt = buildCopyPrompt(inputs)

  if (!import.meta.env.DEV && !geminiApiKeyForBrowser()) {
    return mockGeneratedPost(inputs.topic.description)
  }

  const body = buildCopyGeminiRequestBody(userPrompt)

  for (const model of geminiCopyModelChain()) {
    try {
      const res = await geminiGenerateContent(model, body)
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        console.warn('[Gemini copy]', model, res.status, json)
        continue
      }
      const root = json as { promptFeedback?: { blockReason?: string } }
      if (root.promptFeedback?.blockReason) {
        console.warn('[Gemini copy] promptFeedback', model, root.promptFeedback.blockReason)
        continue
      }
      const text = geminiResponseText(json)
      if (!text) {
        console.warn('[Gemini copy] empty candidates', model)
        continue
      }
      const parsed = parseGeneratedPostFromContent(text)
      if (parsed) return parsed
      console.warn('[Gemini copy] output was not valid JSON with a body field; trying fallback model', model)
    } catch (e) {
      console.warn('[Gemini copy] request error', model, e)
    }
  }

  return mockGeneratedPost(inputs.topic.description)
}

/**
 * Lightweight transform (shorter / sharper / add CTA) using the same Gemini model failover as copy.
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

  if (!import.meta.env.DEV && !geminiApiKeyForBrowser()) {
    if (instruction === 'shorter') return baseText.split('\n').slice(0, 4).join('\n')
    if (instruction === 'sharper') return `${baseText}\n\nBottom line: say the quiet part out loud—then give the next step.`
    return cta ? `${baseText}\n\n${cta}` : baseText
  }

  const body = {
    systemInstruction: {
      parts: [
        {
          text: 'You revise social posts. Return only the revised post text. No JSON, no markdown code fences.',
        },
      ],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Instruction: ${instr}\n\nPOST:\n${baseText}` }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 2048,
    },
  }

  const raw = await geminiTextWithCopyModelFailover(body)
  if (raw?.trim()) return raw.trim()

  if (instruction === 'shorter') return baseText.split('\n').slice(0, 4).join('\n')
  if (instruction === 'sharper') return `${baseText}\n\nBottom line: say the quiet part out loud—then give the next step.`
  return cta ? `${baseText}\n\n${cta}` : baseText
}
