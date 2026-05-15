import { anthropicCopyModelId } from '../config/modelProviders'
import { consumeSseDataJsonLines } from './sseDataLines'

/** Dev: Vite proxy injects `x-api-key`. Prod: set `VITE_ANTHROPIC_API_KEY` (browser; use with care). */
export function anthropicApiKeyForBrowser(): string {
  return String(import.meta.env.VITE_ANTHROPIC_API_KEY ?? '').trim()
}

export function anthropicMessagesUrl(): string {
  if (import.meta.env.DEV) return '/api/anthropic/v1/messages'
  return 'https://api.anthropic.com/v1/messages'
}

export function anthropicMessagesHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
  if (!import.meta.env.DEV) {
    const key = anthropicApiKeyForBrowser()
    if (key) {
      headers['x-api-key'] = key
      // Required for browser-side Anthropic calls when using a publishable-style key in the client.
      headers['anthropic-dangerous-direct-browser-access'] = 'true'
    }
  }
  return headers
}

function textDeltaFromAnthropicSse(obj: unknown): string | null {
  const o = obj as {
    type?: string
    delta?: { type?: string; text?: string }
  }
  if (o.type === 'content_block_delta' && o.delta?.type === 'text_delta' && typeof o.delta.text === 'string') {
    return o.delta.text
  }
  return null
}

/**
 * Streams Claude copy; accumulates JSON text (same contract as Gemini) and calls `onRawAccumulated`.
 */
export async function streamAnthropicCopyJson(params: {
  systemText: string
  userText: string
  onRawAccumulated: (raw: string) => void
}): Promise<string> {
  const { systemText, userText, onRawAccumulated } = params
  const res = await fetch(anthropicMessagesUrl(), {
    method: 'POST',
    headers: anthropicMessagesHeaders(),
    body: JSON.stringify({
      model: anthropicCopyModelId(),
      max_tokens: 8192,
      stream: true,
      system: systemText,
      messages: [{ role: 'user', content: userText }],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic (${res.status}): ${errText.slice(0, 400)}`)
  }

  let accumulated = ''
  await consumeSseDataJsonLines(res, (obj) => {
    const piece = textDeltaFromAnthropicSse(obj)
    if (piece) {
      accumulated += piece
      onRawAccumulated(accumulated)
    }
  })
  return accumulated
}
