/**
 * Dev / preview: list and load customer interview profiles from data/presentations/.
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
const SUPABASE_CATALOG_URL = pathToFileURL(
  path.join(COPY_MAKER_DIR, 'server/interviews-data/supabaseInterviews.mjs'),
).href

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let catalogMod: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseCatalogMod: any = null

async function loadCatalog() {
  if (!catalogMod) catalogMod = await import(CATALOG_URL)
  return catalogMod
}

async function loadSupabaseCatalog() {
  if (!supabaseCatalogMod) supabaseCatalogMod = await import(SUPABASE_CATALOG_URL)
  return supabaseCatalogMod
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
      const { listCallsFromSupabase } = await loadSupabaseCatalog()
      if (!fs.existsSync(PRESENTATIONS_DIR)) {
        const callType = pathname === '/api/demos' ? 'demo' : 'interview'
        const rows = await listCallsFromSupabase(callType)
        if (pathname === '/api/demos') {
          sendJson(res, { count: rows.length, demos: rows, warning: 'Loaded from Supabase fallback' })
          return
        }
        const byPersona = { tofu: 0, mofu: 0, bofu: 0 }
        for (const i of rows) {
          const p = i.persona as keyof typeof byPersona
          if (p && p in byPersona) byPersona[p]++
        }
        sendJson(
          res,
          { count: rows.length, byPersona, interviews: rows, warning: 'Loaded from Supabase fallback' },
        )
        return
      }
      if (pathname === '/api/demos') {
        const demosFromFs = listDemos()
        const demos = demosFromFs.length ? demosFromFs : await listCallsFromSupabase('demo')
        sendJson(res, { count: demos.length, demos })
        return
      }
      const interviewsFromFs = listInterviews()
      const interviews =
        interviewsFromFs.length ? interviewsFromFs : await listCallsFromSupabase('interview')
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
      const { getInterviewDetailFromSupabase } = await loadSupabaseCatalog()
      const detail = getInterviewDetail(demoExportMatch[1]!) ?? (await getInterviewDetailFromSupabase(demoExportMatch[1]!))
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
      const { getInterviewDetailFromSupabase } = await loadSupabaseCatalog()
      const detail = getInterviewDetail(demoDetailMatch[1]!) ?? (await getInterviewDetailFromSupabase(demoDetailMatch[1]!))
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
      const { getInterviewDetailFromSupabase } = await loadSupabaseCatalog()
      const detail = getInterviewDetail(exportMatch[1]!) ?? (await getInterviewDetailFromSupabase(exportMatch[1]!))
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
      const { getInterviewDetailFromSupabase } = await loadSupabaseCatalog()
      const detail = getInterviewDetail(detailMatch[1]!) ?? (await getInterviewDetailFromSupabase(detailMatch[1]!))
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
