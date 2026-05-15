import { openaiCopyModelId } from '../config/modelProviders'
import { consumeSseDataJsonLines } from './sseDataLines'

export function openaiApiKeyForBrowser(): string {
  return String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim()
}

export function openaiChatCompletionsUrl(): string {
  if (import.meta.env.DEV) return '/api/openai/v1/chat/completions'
  return 'https://api.openai.com/v1/chat/completions'
}

export function openaiChatHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!import.meta.env.DEV) {
    const key = openaiApiKeyForBrowser()
    if (key) headers.Authorization = `Bearer ${key}`
  }
  return headers
}

function textDeltaFromOpenAiSse(obj: unknown): string | null {
  const o = obj as {
    choices?: Array<{ delta?: { content?: string | null } }>
  }
  const c = o.choices?.[0]?.delta?.content
  return typeof c === 'string' && c.length > 0 ? c : null
}

/**
 * Streams OpenAI chat completions; accumulates JSON text and calls `onRawAccumulated`.
 */
export async function streamOpenAiCopyJson(params: {
  systemText: string
  userText: string
  onRawAccumulated: (raw: string) => void
}): Promise<string> {
  const { systemText, userText, onRawAccumulated } = params
  const res = await fetch(openaiChatCompletionsUrl(), {
    method: 'POST',
    headers: openaiChatHeaders(),
    body: JSON.stringify({
      model: openaiCopyModelId(),
      stream: true,
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userText },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI (${res.status}): ${errText.slice(0, 400)}`)
  }

  let accumulated = ''
  await consumeSseDataJsonLines(res, (obj) => {
    const piece = textDeltaFromOpenAiSse(obj)
    if (piece) {
      accumulated += piece
      onRawAccumulated(accumulated)
    }
  })
  return accumulated
}
