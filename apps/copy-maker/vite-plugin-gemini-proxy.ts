/**
 * Dev + `vite preview`: same-origin `/api/gemini/*` → Google Gemini Developer API.
 * The browser never holds `GEMINI_API_KEY`; only this Node middleware reads it from the environment.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Connect, Plugin } from 'vite'

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function geminiKeyFromEnv(): string {
  return (
    String(process.env.GEMINI_API_KEY ?? '').trim() ||
    String(process.env.GOOGLE_AI_API_KEY ?? '').trim()
  )
}

async function proxyGeminiToUpstream(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
  const pathname = rawUrl.split('?')[0] ?? ''
  const query = rawUrl.includes('?') ? `?${rawUrl.split('?').slice(1).join('?')}` : ''

  const apiKey = geminiKeyFromEnv()
  if (!apiKey) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: 'missing_gemini_key',
        hint: 'Set GEMINI_API_KEY or GOOGLE_AI_API_KEY in the server environment (Railway Variables).',
      }),
    )
    return
  }

  let suffix = pathname.replace(/^\/api\/gemini/, '')
  if (!suffix.startsWith('/')) suffix = `/${suffix}`
  const targetUrl = `https://generativelanguage.googleapis.com${suffix}${query}`

  const bodyBuf = req.method === 'POST' ? await readRequestBody(req) : Buffer.alloc(0)

  const upstream = await fetch(targetUrl, {
    method: req.method || 'POST',
    headers: {
      'Content-Type': String(req.headers['content-type'] || 'application/json'),
      'x-goog-api-key': apiKey,
    },
    body: req.method === 'POST' && bodyBuf.length > 0 ? bodyBuf : undefined,
  })

  res.statusCode = upstream.status
  const ct = upstream.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)

  if (!upstream.body) {
    res.end()
    return
  }

  const webBody = upstream.body as import('stream/web').ReadableStream<Uint8Array>
  await pipeline(Readable.fromWeb(webBody), res)
}

export function geminiProxyPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
    const pathname = rawUrl.split('?')[0] ?? ''

    if (!pathname.startsWith('/api/gemini')) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('Gemini proxy expects POST')
      return
    }

    void proxyGeminiToUpstream(req as IncomingMessage, res as ServerResponse).catch((e) => {
      console.error('[gemini-proxy]', e)
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.statusCode = 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(String((e as Error)?.message ?? 'gemini_proxy_error'))
    })
  }

  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
