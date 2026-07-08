/**
 * Dev + `vite preview` (Railway): proxy `/api/openrouter/*` → `https://openrouter.ai/api/*` with `OPENROUTER_API_KEY` on the server.
 * The browser posts same-origin only (OpenRouter does not allow cross-origin API-key calls from the web app).
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

async function proxyOpenRouterToUpstream(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
  const pathname = rawUrl.split('?')[0] ?? ''
  const query = rawUrl.includes('?') ? `?${rawUrl.split('?').slice(1).join('?')}` : ''

  const apiKey = String(process.env.OPENROUTER_API_KEY ?? '').trim()

  if (!apiKey) {
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(
      JSON.stringify({
        error: 'missing_openrouter_key',
        hint: 'Set OPENROUTER_API_KEY in the server environment (e.g. Railway Variables).',
      }),
    )
    return
  }

  // Browser calls `/api/openrouter/v1/...`; upstream lives under `https://openrouter.ai/api/v1/...` (note `/api`).
  let suffix = pathname.replace(/^\/api\/openrouter/, '')
  if (!suffix.startsWith('/')) suffix = `/${suffix}`
  const targetUrl = `https://openrouter.ai/api${suffix}${query}`

  const bodyBuf = await readRequestBody(req)

  const forwardHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': String(req.headers['content-type'] || 'application/json'),
  }

  const ref = req.headers['http-referer'] ?? req.headers['referer']
  if (typeof ref === 'string' && ref.trim()) forwardHeaders['HTTP-Referer'] = ref

  const title = req.headers['x-title']
  if (typeof title === 'string' && title.trim()) forwardHeaders['X-Title'] = title

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers: forwardHeaders,
    body: bodyBuf.length > 0 ? bodyBuf : undefined,
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

export function openRouterProxyPlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
    const pathname = rawUrl.split('?')[0] ?? ''

    if (!pathname.startsWith('/api/openrouter')) {
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
      res.end('OpenRouter proxy expects POST')
      return
    }

    void proxyOpenRouterToUpstream(req as IncomingMessage, res as ServerResponse).catch((e) => {
      console.error('[openrouter-proxy]', e)
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.statusCode = 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(String((e as Error)?.message ?? 'openrouter_proxy_error'))
    })
  }

  return {
    name: 'openrouter-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
