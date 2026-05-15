/**
 * Dev / preview middleware: OS brand files + merged outlier catalog
 * (outliers_index.json + outlier_framework_cache.json) for framework / copy-example pickers.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const COPY_MAKER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(COPY_MAKER_DIR, '..')
const OS_DIR = path.join(REPO_ROOT, 'OS')
const OUTLIERS_INDEX = path.join(REPO_ROOT, 'linkedin_influencers', 'data', 'outliers_index.json')
const OUTLIER_FW_CACHE = path.join(REPO_ROOT, 'linkedin_influencers', 'data', 'outlier_framework_cache.json')
const STYLE_GUIDE_MD = path.join(OS_DIR, 'Style Guide', 'vantum_style_guide.md')
const STYLE_GUIDE_HTML = path.join(OS_DIR, 'Style Guide', 'vantum_pdf_design_system_v2.html')
const VOICES_DIR = path.join(OS_DIR, 'Voices')
const PERSONAS_DIR = path.join(OS_DIR, 'Customer Personas')

const VOICE_FILES: Record<string, string> = {
  vantum: 'vantum.md',
  tabarak: 'tabarak.md',
  brian: 'brian.md',
}

const PERSONA_FILES: Record<string, string> = {
  tofu: 'vantum-persona-tofu.md',
  mofu: 'vantum-persona-mofu.md',
  bofu: 'vantum-persona-bofu.md',
}

type CatalogEntry = {
  id: string
  urn: string
  creator: string
  slug: string
  hook: string
  url: string
  axes: string
  formatTags: string[]
  structuralTags: string[]
  searchText: string
  hasFramework: boolean
  frameworkBody: string
  postBody: string
  textPreview: string
  maxRatio: number
}

let catalogCache: { indexMtime: number; cacheMtime: number; entries: CatalogEntry[] } | null = null

function htmlToPlainText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function loadFrameworkCache(): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync(OUTLIER_FW_CACHE)) return out
  try {
    const raw = JSON.parse(fs.readFileSync(OUTLIER_FW_CACHE, 'utf8')) as { items?: unknown }
    if (!raw.items || typeof raw.items !== 'object' || Array.isArray(raw.items)) return out
    for (const [k, v] of Object.entries(raw.items as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim().length > 0) out[k] = v
    }
  } catch {
    /* ignore */
  }
  return out
}

/**
 * Merge index (post text + tags) with framework cache (markdown extractions keyed by URN).
 */
function buildOutliersCatalog(): CatalogEntry[] {
  if (!fs.existsSync(OUTLIERS_INDEX)) return []
  const iSt = fs.statSync(OUTLIERS_INDEX)
  const cSt = fs.existsSync(OUTLIER_FW_CACHE) ? fs.statSync(OUTLIER_FW_CACHE) : { mtimeMs: 0 }
  if (catalogCache && catalogCache.indexMtime === iSt.mtimeMs && catalogCache.cacheMtime === cSt.mtimeMs) {
    return catalogCache.entries
  }

  const index = JSON.parse(fs.readFileSync(OUTLIERS_INDEX, 'utf8')) as {
    bySlug?: Array<{ slug?: string; name?: string; outliers?: Array<Record<string, unknown>> }>
  }
  const fwItems = loadFrameworkCache()
  const entries: CatalogEntry[] = []

  for (const block of index.bySlug ?? []) {
    const creator = String(block.name || block.slug || 'Unknown')
    const slug = String(block.slug || '')
    for (const rec of block.outliers ?? []) {
      const urn = String(rec.urn || '')
      if (!urn) continue
      const hook = String(rec.hook || '')
      const url = String(rec.url || '')
      const postBody = String(rec.text || '')
      const textPreview = String(rec.textPreview || postBody).slice(0, 280)
      const formatTags = Array.isArray(rec.format_level) ? (rec.format_level as unknown[]).map(String) : []
      const structuralTags = Array.isArray(rec.structural) ? (rec.structural as unknown[]).map(String) : []
      const ot = Array.isArray(rec.outlierTypes) ? (rec.outlierTypes as unknown[]).map(String) : []
      const axes = ot.join('+')
      const frameworkBody = fwItems[urn] ?? ''
      const hasFramework = frameworkBody.trim().length > 80
      const maxRatio = typeof rec.maxRatio === 'number' ? rec.maxRatio : 0

      const searchText = [creator, slug, hook, urn, axes, ...formatTags, ...structuralTags]
        .join(' ')
        .toLowerCase()

      entries.push({
        id: urn,
        urn,
        creator,
        slug,
        hook,
        url,
        axes,
        formatTags,
        structuralTags,
        searchText,
        hasFramework,
        frameworkBody,
        postBody,
        textPreview,
        maxRatio,
      })
    }
  }

  entries.sort((a, b) => b.maxRatio - a.maxRatio)
  catalogCache = { indexMtime: iSt.mtimeMs, cacheMtime: cSt.mtimeMs, entries }
  return entries
}

function sendJson(res: { statusCode: number; setHeader: (a: string, b: string) => void; end: (s: string) => void }, data: unknown, code = 200) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function copyMakerDataMiddleware(
  req: { url?: string; method?: string },
  res: { statusCode: number; setHeader: (a: string, b: string) => void; end: (s: string) => void },
  next: () => void,
) {
  const rawUrl = req.url ?? ''
  const pathname = rawUrl.split('?')[0] ?? ''

  if (req.method !== 'GET') {
    next()
    return
  }

  if (pathname === '/api/os/style-guide') {
    try {
      if (fs.existsSync(STYLE_GUIDE_MD)) {
        const text = fs.readFileSync(STYLE_GUIDE_MD, 'utf8')
        sendJson(res, { text, source: 'OS/Style Guide/vantum_style_guide.md' })
        return
      }
      if (!fs.existsSync(STYLE_GUIDE_HTML)) {
        sendJson(res, { text: '', error: 'missing_style_guide', path: STYLE_GUIDE_HTML })
        return
      }
      const html = fs.readFileSync(STYLE_GUIDE_HTML, 'utf8')
      sendJson(res, { text: htmlToPlainText(html), source: 'OS/Style Guide/vantum_pdf_design_system_v2.html' })
    } catch (e) {
      sendJson(res, { error: String(e) }, 500)
    }
    return
  }

  const voiceMatch = /^\/api\/os\/writer-voice\/([^/]+)$/.exec(pathname)
  if (voiceMatch) {
    const id = voiceMatch[1]!.toLowerCase()
    const file = VOICE_FILES[id]
    if (!file || id.includes('.')) {
      sendJson(res, { error: 'unknown_voice' }, 404)
      return
    }
    const fp = path.join(VOICES_DIR, file)
    if (!fs.existsSync(fp)) {
      sendJson(res, { error: 'missing_file', path: fp }, 404)
      return
    }
    sendJson(res, { id, text: fs.readFileSync(fp, 'utf8'), source: `OS/Voices/${file}` })
    return
  }

  const personaMatch = /^\/api\/os\/customer-persona\/([^/]+)$/.exec(pathname)
  if (personaMatch) {
    const id = personaMatch[1]!.toLowerCase()
    const file = PERSONA_FILES[id]
    if (!file || id.includes('.')) {
      sendJson(res, { error: 'unknown_persona' }, 404)
      return
    }
    const fp = path.join(PERSONAS_DIR, file)
    if (!fs.existsSync(fp)) {
      sendJson(res, { error: 'missing_file', path: fp }, 404)
      return
    }
    sendJson(res, { id, text: fs.readFileSync(fp, 'utf8'), source: `OS/Customer Personas/${file}` })
    return
  }

  if (pathname === '/api/outliers-catalog') {
    try {
      const entries = buildOutliersCatalog()
      sendJson(res, {
        count: entries.length,
        entries,
        indexPath: OUTLIERS_INDEX,
        cachePath: OUTLIER_FW_CACHE,
      })
    } catch (e) {
      sendJson(res, { error: String(e), entries: [] }, 500)
    }
    return
  }

  next()
}

export function copyMakerDataPlugin(): Plugin {
  return {
    name: 'copy-maker-data',
    configureServer(server) {
      server.middlewares.use(copyMakerDataMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(copyMakerDataMiddleware)
    },
  }
}
