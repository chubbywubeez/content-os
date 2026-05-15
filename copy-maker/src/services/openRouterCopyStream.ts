import { consumeSseDataJsonLines } from './sseDataLines'

/**
 * Production: set `VITE_OPENROUTER_API_KEY` so Opus + GPT copy options hit OpenRouter from the browser.
 * Dev: use `OPENROUTER_API_KEY` (or `VITE_OPENROUTER_API_KEY`) in repo-root `.env`; Vite proxies `/api/openrouter/*`
 * so the key never has to be `VITE_` for local-only use.
 */
export function openRouterApiKeyForBrowser(): string {
  return String(import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim()
}

/** OpenAI-compatible chat completions (OpenRouter). */
export function openRouterChatCompletionsUrl(): string {
  if (import.meta.env.DEV) return '/api/openrouter/v1/chat/completions'
  return 'https://openrouter.ai/api/v1/chat/completions'
}

export function openRouterChatHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // In dev the Vite proxy injects Authorization from `.env`; avoid sending an empty Bearer.
  if (!import.meta.env.DEV) {
    const key = openRouterApiKeyForBrowser()
    if (key) headers.Authorization = `Bearer ${key}`
  }
  // OpenRouter recommends these for rankings; both are optional.
  const referer = String(import.meta.env.VITE_OPENROUTER_HTTP_REFERER ?? '').trim()
  if (referer) headers['HTTP-Referer'] = referer
  const title = String(import.meta.env.VITE_OPENROUTER_APP_TITLE ?? '').trim()
  if (title) headers['X-Title'] = title
  return headers
}

/** Same shape as OpenAI streaming chat completions (`choices[0].delta.content`). */
function textDeltaFromOpenRouterSse(obj: unknown): string | null {
  const o = obj as {
    choices?: Array<{ delta?: { content?: string | null } }>
  }
  const c = o.choices?.[0]?.delta?.content
  return typeof c === 'string' && c.length > 0 ? c : null
}

/**
 * Streams copy via OpenRouter (OpenAI-compatible SSE). Same JSON-in-markdown contract as Gemini/Anthropic.
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
