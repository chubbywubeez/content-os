/**
 * Shared Google Gemini Developer API (`generativelanguage.googleapis.com`) client.
 * Gemini copy + image generation use this path. Opus / OpenAI copy use Anthropic and OpenAI clients.
 */

/** Client-visible keys in production builds (must use `VITE_` prefix in `.env`). */
export function geminiApiKeyForBrowser(): string {
  const e = import.meta.env
  return (
    String(e.VITE_GEMINI_API_KEY ?? '').trim() ||
    String(e.VITE_GOOGLE_AI_API_KEY ?? '').trim() ||
    String(e.VITE_NANO_BANANA_API_KEY ?? '').trim()
  )
}

/**
 * In dev, Vite proxies `/api/gemini/*` and injects the key from disk (see `vite.config.ts`).
 * In production, the browser sends `x-goog-api-key` when the key is present.
 */
export function geminiGenerateContentUrl(model: string): string {
  const safe = encodeURIComponent(model)
  const suffix = `/v1beta/models/${safe}:generateContent`
  if (import.meta.env.DEV) {
    return `/api/gemini${suffix}`
  }
  const base =
    String(import.meta.env.VITE_GEMINI_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'https://generativelanguage.googleapis.com'
  return `${base}${suffix}`
}

/** Same host as `generateContent`, but SSE stream (`data: {json}` lines per chunk). */
export function geminiStreamGenerateContentUrl(model: string): string {
  const safe = encodeURIComponent(model)
  const suffix = `/v1beta/models/${safe}:streamGenerateContent?alt=sse`
  if (import.meta.env.DEV) {
    return `/api/gemini${suffix}`
  }
  const base =
    String(import.meta.env.VITE_GEMINI_BASE_URL ?? '').trim().replace(/\/$/, '') ||
    'https://generativelanguage.googleapis.com'
  return `${base}${suffix}`
}

/** Headers for `generateContent`. In dev the proxy adds `x-goog-api-key` if missing here. */
export function geminiGenerateHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!import.meta.env.DEV) {
    const key = geminiApiKeyForBrowser()
    if (key) headers['x-goog-api-key'] = key
  }
  return headers
}

/** POST to `:generateContent` for the given model id. */
export async function geminiGenerateContent(model: string, body: unknown): Promise<Response> {
  const url = geminiGenerateContentUrl(model)
  return fetch(url, {
    method: 'POST',
    headers: geminiGenerateHeaders(),
    body: JSON.stringify(body),
  })
}

/** POST to `:streamGenerateContent?alt=sse` — response body is `text/event-stream`. */
export async function geminiStreamGenerateContent(model: string, body: unknown): Promise<Response> {
  const url = geminiStreamGenerateContentUrl(model)
  return fetch(url, {
    method: 'POST',
    headers: geminiGenerateHeaders(),
    body: JSON.stringify(body),
  })
}

import { consumeSseDataJsonLines } from './sseDataLines'

/**
 * Reads Gemini SSE: each `data: {…}` line is one `GenerateContentResponse` JSON object.
 * Invokes `onMessage` for each parsed object (incremental text is merged by the caller).
 */
export async function consumeGeminiSseJson(
  response: Response,
  onMessage: (obj: unknown) => void,
): Promise<void> {
  await consumeSseDataJsonLines(response, onMessage)
}

/** Join all text parts from the first candidate (plain text or JSON-as-text). */
export function geminiResponseText(json: unknown): string | null {
  const root = json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = root.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null
  const chunks = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).filter((t) => t.length > 0)
  const merged = chunks.join('\n').trim()
  return merged || null
}
