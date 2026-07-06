/**
 * API routes:
 * - POST /api/transcript-pipeline/run (SSE pipeline progress)
 * - GET  /api/pipeline-prompts (list prompt manager records)
 * - PUT  /api/pipeline-prompts/:key (save prompt content)
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
// @ts-ignore - Node ESM module without generated .d.ts
import { runTranscriptPipeline } from './server/transcript-pipeline/runPipeline.mjs'
// @ts-ignore - Node ESM module without generated .d.ts
import { listPipelinePrompts, savePipelinePrompt } from './server/transcript-pipeline/pipelinePrompts.mjs'

async function readMultipartText(req: IncomingMessage): Promise<{ text: string; filename: string }> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const buf = Buffer.concat(chunks)
  const bodyStr = buf.toString('utf8')

  const ct = String(req.headers['content-type'] || '')
  if (ct.includes('multipart/form-data')) {
    const boundaryMatch = ct.match(/boundary=(.+)$/i)
    const boundary = boundaryMatch?.[1]?.trim().replace(/^"|"$/g, '')
    if (!boundary) throw new Error('Missing multipart boundary')

    const parts = bodyStr.split(`--${boundary}`)
    for (const part of parts) {
      if (!part.includes('filename=')) continue
      const nameMatch = part.match(/filename="([^"]+)"/)
      const filename = nameMatch?.[1] || 'transcript.txt'
      const headerEnd = part.indexOf('\r\n\r\n')
      const headerEndLf = part.indexOf('\n\n')
      const splitAt = headerEnd >= 0 ? headerEnd + 4 : headerEndLf >= 0 ? headerEndLf + 2 : -1
      if (splitAt < 0) continue
      let content = part.slice(splitAt)
      content = content.replace(/\r\n--\s*$/, '').replace(/\n--\s*$/, '').trimEnd()
      if (content.endsWith('--')) content = content.slice(0, -2).trimEnd()
      return { text: content, filename }
    }
    throw new Error('No file in multipart upload')
  }

  if (ct.includes('application/json')) {
    const json = JSON.parse(bodyStr) as { text?: string; filename?: string }
    return { text: String(json.text || ''), filename: String(json.filename || 'transcript.txt') }
  }

  return { text: bodyStr, filename: 'transcript.txt' }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks).toString('utf8').trim()
  if (!body) return {}
  const parsed = JSON.parse(body) as Record<string, unknown>
  return parsed ?? {}
}

function writeSse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function handlePipelineRun(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  let payload: { text: string; filename: string }
  try {
    payload = await readMultipartText(req)
  } catch (e) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
    return
  }

  if (!payload.text.trim()) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'empty_transcript' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  // #region agent log
  fetch('http://127.0.0.1:7678/ingest/3f1696be-2378-40bd-9460-3f07727eecbb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cfd468'},body:JSON.stringify({sessionId:'cfd468',runId:'initial',hypothesisId:'H3-H5',location:'vite-plugin-transcript-pipeline.ts:handlePipelineRun',message:'Pipeline endpoint accepted request',data:{cwd:process.cwd(),hasOpenRouterEnv:Boolean(process.env.OPENROUTER_API_KEY),openRouterEnvLength:String(process.env.OPENROUTER_API_KEY ?? '').length,filename:payload.filename,textLength:payload.text.length},timestamp:Date.now()})}).catch(()=>{})
  // #endregion

  try {
    for await (const ev of runTranscriptPipeline(payload.text, payload.filename)) {
      writeSse(res, ev.status === 'error' ? 'error' : 'step', ev)
      if (ev.status === 'error') break
    }
    writeSse(res, 'done', { ok: true })
  } catch (e) {
    writeSse(res, 'error', {
      step: 'error',
      status: 'error',
      title: 'Pipeline failed',
      message: e instanceof Error ? e.message : String(e),
    })
  } finally {
    res.end()
  }
}

async function handlePipelinePrompts(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    try {
      const data = await listPipelinePrompts()
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(data))
    } catch (e) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
    }
    return
  }
  res.statusCode = 405
  res.end('Method not allowed')
}

async function handlePipelinePromptSave(req: IncomingMessage, res: ServerResponse, key: string) {
  if (req.method !== 'PUT') {
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }
  try {
    const body = await readJsonBody(req)
    const content = typeof body.content === 'string' ? body.content : ''
    const result = await savePipelinePrompt({ key, content })
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  } catch (e) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
  }
}

export function transcriptPipelinePlugin(): Plugin {
  const handler = (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ) => {
    const rawUrl = (req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? ''
    const pathname = rawUrl.split('?')[0] ?? ''
    if (pathname === '/api/transcript-pipeline/run') {
      void handlePipelineRun(req, res)
      return
    }
    if (pathname === '/api/pipeline-prompts') {
      void handlePipelinePrompts(req, res)
      return
    }
    if (pathname.startsWith('/api/pipeline-prompts/')) {
      const key = decodeURIComponent(pathname.slice('/api/pipeline-prompts/'.length))
      void handlePipelinePromptSave(req, res, key)
      return
    }
    next()
  }

  return {
    name: 'transcript-pipeline',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
