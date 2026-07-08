import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
// @ts-ignore - Node ESM module without generated .d.ts
import { getLeadMagnetArtifacts, listLeadMagnetResourceEntries, resolveLeadMagnetFile, runLeadMagnetPipeline } from './server/lead-magnet-pipeline/runPipeline.mjs'

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks).toString('utf8').trim()
  if (!body) return {}
  return (JSON.parse(body) as Record<string, unknown>) ?? {}
}

function writeSse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function handleLeadMagnetRun(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  let body
  try {
    body = await readJsonBody(req)
  } catch (e) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
    return
  }
  const slug = String(body.slug ?? '').trim()
  const briefMarkdown = String(body.briefMarkdown ?? body.markdown ?? '').trim()
  if (!briefMarkdown) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'brief_markdown_required' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    for await (const ev of runLeadMagnetPipeline({ slug, briefMarkdown })) {
      writeSse(res, ev.status === 'error' ? 'error' : 'step', ev)
      if (ev.status === 'error') break
    }
    writeSse(res, 'done', { ok: true })
  } catch (e) {
    writeSse(res, 'error', {
      step: 'final_render',
      status: 'error',
      title: 'Lead Magnet Pipeline',
      message: e instanceof Error ? e.message : String(e),
    })
  } finally {
    res.end()
  }
}

function handleLeadMagnetArtifacts(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  try {
    const parsed = new URL(req.url ?? '', 'http://local')
    const slug = parsed.searchParams.get('slug') || ''
    const data = getLeadMagnetArtifacts(slug)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
  } catch (e) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
}

function handleLeadMagnetResources(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  try {
    const entries = listLeadMagnetResourceEntries()
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ entries }))
  } catch (e) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
}

function handleLeadMagnetFile(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  try {
    const parsed = new URL(req.url ?? '', 'http://local')
    const slug = parsed.searchParams.get('slug') || ''
    const name = parsed.searchParams.get('name') || ''
    const file = resolveLeadMagnetFile(slug, name)
    if (!file) {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    const shouldDownload = parsed.searchParams.get('download') === '1'
    res.statusCode = 200
    res.setHeader('Content-Type', file.contentType)
    if (shouldDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.slug}-${file.name}"`)
    }
    fs.createReadStream(file.absPath).pipe(res)
  } catch (e) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
}

export function leadMagnetPipelinePlugin(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
    const pathname = rawUrl.split('?')[0] ?? ''
    if (pathname === '/api/lead-magnet-pipeline/run') {
      void handleLeadMagnetRun(req, res)
      return
    }
    if (pathname === '/api/lead-magnet-pipeline/artifacts') {
      handleLeadMagnetArtifacts(req, res)
      return
    }
    if (pathname === '/api/lead-magnet-pipeline/resources') {
      handleLeadMagnetResources(req, res)
      return
    }
    if (pathname === '/api/lead-magnet-pipeline/file') {
      handleLeadMagnetFile(req, res)
      return
    }
    next()
  }
  return {
    name: 'lead-magnet-pipeline',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
