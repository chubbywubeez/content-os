/**
 * Dev / preview: list and load customer interview profiles from Problem Presentations/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const COPY_MAKER_DIR = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_URL = pathToFileURL(
  path.join(COPY_MAKER_DIR, 'server/interviews-data/interviewsCatalog.mjs'),
).href

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let catalogMod: any = null

async function loadCatalog() {
  if (!catalogMod) catalogMod = await import(CATALOG_URL)
  return catalogMod
}

function sendJson(res: ServerResponse, data: unknown, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function sendText(res: ServerResponse, text: string, contentType: string) {
  res.statusCode = 200
  res.setHeader('Content-Type', contentType)
  res.end(text)
}

async function interviewsMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) {
  const rawUrl = req.url ?? ''
  const pathname = rawUrl.split('?')[0] ?? ''

  if (req.method !== 'GET') {
    next()
    return
  }

  if (pathname === '/api/interviews' || pathname === '/api/demos') {
    try {
      const { listInterviews, listDemos, PRESENTATIONS_DIR } = await loadCatalog()
      if (!fs.existsSync(PRESENTATIONS_DIR)) {
        const empty = pathname === '/api/demos' ? { count: 0, demos: [] } : { count: 0, interviews: [] }
        sendJson(res, { ...empty, warning: 'Problem Presentations folder not found' })
        return
      }
      if (pathname === '/api/demos') {
        const demos = listDemos()
        sendJson(res, { count: demos.length, demos })
        return
      }
      const interviews = listInterviews()
      const byPersona = { tofu: 0, mofu: 0, bofu: 0 }
      for (const i of interviews) {
        const p = i.persona as keyof typeof byPersona
        if (p && p in byPersona) byPersona[p]++
      }
      sendJson(res, { count: interviews.length, byPersona, interviews })
    } catch (e) {
      sendJson(res, { error: String(e), interviews: [], demos: [] }, 500)
    }
    return
  }

  const demoExportMatch = /^\/api\/demos\/([^/]+)\/export\.md$/.exec(pathname)
  if (demoExportMatch) {
    try {
      const { getInterviewDetail, buildInterviewExportMarkdown } = await loadCatalog()
      const detail = getInterviewDetail(demoExportMatch[1]!)
      if (!detail || detail.callType !== 'demo') {
        sendJson(res, { error: 'not_found' }, 404)
        return
      }
      const md = buildInterviewExportMarkdown(detail)
      const safe = detail.displayName.replace(/[^\w.-]+/g, '_')
      res.setHeader('Content-Disposition', `attachment; filename="${safe}-demo.md"`)
      sendText(res, md, 'text/markdown; charset=utf-8')
    } catch (e) {
      sendJson(res, { error: String(e) }, 500)
    }
    return
  }

  const demoDetailMatch = /^\/api\/demos\/([^/]+)$/.exec(pathname)
  if (demoDetailMatch) {
    try {
      const { getInterviewDetail } = await loadCatalog()
      const detail = getInterviewDetail(demoDetailMatch[1]!)
      if (!detail || detail.callType !== 'demo') {
        sendJson(res, { error: 'not_found' }, 404)
        return
      }
      sendJson(res, detail)
    } catch (e) {
      sendJson(res, { error: String(e) }, 500)
    }
    return
  }

  const exportMatch = /^\/api\/interviews\/([^/]+)\/export\.md$/.exec(pathname)
  if (exportMatch) {
    try {
      const { getInterviewDetail, buildInterviewExportMarkdown } = await loadCatalog()
      const detail = getInterviewDetail(exportMatch[1]!)
      if (!detail) {
        sendJson(res, { error: 'not_found' }, 404)
        return
      }
      const md = buildInterviewExportMarkdown(detail)
      const safe = detail.displayName.replace(/[^\w.-]+/g, '_')
      res.setHeader('Content-Disposition', `attachment; filename="${safe}-interview.md"`)
      sendText(res, md, 'text/markdown; charset=utf-8')
    } catch (e) {
      sendJson(res, { error: String(e) }, 500)
    }
    return
  }

  const detailMatch = /^\/api\/interviews\/([^/]+)$/.exec(pathname)
  if (detailMatch) {
    try {
      const { getInterviewDetail } = await loadCatalog()
      const detail = getInterviewDetail(detailMatch[1]!)
      if (!detail) {
        sendJson(res, { error: 'not_found' }, 404)
        return
      }
      sendJson(res, detail)
    } catch (e) {
      sendJson(res, { error: String(e) }, 500)
    }
    return
  }

  next()
}

export function interviewsDataPlugin(): Plugin {
  return {
    name: 'interviews-data',
    configureServer(server) {
      server.middlewares.use(interviewsMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(interviewsMiddleware)
    },
  }
}
