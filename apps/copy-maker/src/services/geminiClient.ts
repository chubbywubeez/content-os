import { consumeSseDataJsonLines } from './sseDataLines'

/**
 * Google Gemini Developer API via same-origin `/api/gemini/*` (see `vite-plugin-gemini-proxy.ts`).
 * The browser never sends API keys; `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` live only on the server.
 */

export function geminiGenerateContentUrl(model: string): string {
  const safe = encodeURIComponent(model)
  return `/api/gemini/v1beta/models/${safe}:generateContent`
}

export function geminiStreamGenerateContentUrl(model: string): string {
  const safe = encodeURIComponent(model)
  return `/api/gemini/v1beta/models/${safe}:streamGenerateContent?alt=sse`
}

export function geminiGenerateHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}

export async function geminiGenerateContent(model: string, body: unknown): Promise<Response> {
  return fetch(geminiGenerateContentUrl(model), {
    method: 'POST',
    headers: geminiGenerateHeaders(),
    body: JSON.stringify(body),
  })
}

export async function geminiStreamGenerateContent(model: string, body: unknown): Promise<Response> {
  return fetch(geminiStreamGenerateContentUrl(model), {
    method: 'POST',
    headers: geminiGenerateHeaders(),
    body: JSON.stringify(body),
  })
}

export async function consumeGeminiSseJson(
  response: Response,
  onMessage: (obj: unknown) => void,
): Promise<void> {
  await consumeSseDataJsonLines(response, onMessage)
}

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
