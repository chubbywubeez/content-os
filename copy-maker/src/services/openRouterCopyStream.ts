import { consumeSseDataJsonLines } from './sseDataLines'

/**
 * Same-origin chat completions. The Vite dev server / `vite preview` proxy adds `Authorization`
 * using `OPENROUTER_API_KEY` from the environment (never bundled into the client).
 */
export function openRouterChatCompletionsUrl(): string {
  return '/api/openrouter/v1/chat/completions'
}

export function openRouterChatHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined' && window.location?.href) {
    headers['HTTP-Referer'] = window.location.href
  }
  return headers
}

/** Streaming: `choices[0].delta.content`. */
function textDeltaFromOpenRouterSse(obj: unknown): string | null {
  const o = obj as {
    choices?: Array<{ delta?: { content?: string | null } }>
  }
  const c = o.choices?.[0]?.delta?.content
  return typeof c === 'string' && c.length > 0 ? c : null
}

/**
 * Streams copy via OpenRouter (OpenAI-compatible SSE). Same JSON `body` contract in the assistant text.
 */
export async function streamOpenRouterCopyJson(params: {
  model: string
  systemText: string
  userText: string
  onRawAccumulated: (raw: string) => void
}): Promise<string> {
  const { model, systemText, userText, onRawAccumulated } = params
  const res = await fetch(openRouterChatCompletionsUrl(), {
    method: 'POST',
    headers: openRouterChatHeaders(),
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userText },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter (${res.status}): ${errText.slice(0, 400)}`)
  }

  let accumulated = ''
  await consumeSseDataJsonLines(res, (obj) => {
    const piece = textDeltaFromOpenRouterSse(obj)
    if (piece) {
      accumulated += piece
      onRawAccumulated(accumulated)
    }
  })
  return accumulated
}

/** Non-streaming chat completion; returns assistant message text. */
export async function openRouterChatNonStream(params: {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  max_tokens?: number
}): Promise<string> {
  const res = await fetch(openRouterChatCompletionsUrl(), {
    method: 'POST',
    headers: openRouterChatHeaders(),
    body: JSON.stringify({
      model: params.model,
      stream: false,
      messages: params.messages,
      temperature: params.temperature ?? 0.5,
      max_tokens: params.max_tokens ?? 8192,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter (${res.status}): ${errText.slice(0, 400)}`)
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const c = json.choices?.[0]?.message?.content
  return typeof c === 'string' ? c.trim() : ''
}
