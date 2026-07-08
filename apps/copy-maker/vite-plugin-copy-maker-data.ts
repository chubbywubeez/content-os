/**
 * Dev / preview middleware: OS brand files + outlier catalog for framework / copy-example pickers.
 * Prefers `outliers_swipe_catalog.json` (compiled from `*_cleaned.md` swipe files).
 * Falls back to outliers_index.json + outlier_framework_cache.json when swipe catalog is missing/empty.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const COPY_MAKER_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(COPY_MAKER_DIR, '../..')
const OS_DIR = path.join(REPO_ROOT, 'data', 'os')
const OUTLIERS_INDEX = path.join(REPO_ROOT, 'data', 'outliers', 'data', 'outliers_index.json')
const OUTLIER_FW_CACHE = path.join(REPO_ROOT, 'data', 'outliers', 'data', 'outlier_framework_cache.json')
const SWIPE_CATALOG = path.join(REPO_ROOT, 'data', 'outliers', 'data', 'outliers_swipe_catalog.json')
const REMOTE_CATALOG_TTL_MS = 60_000
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
  frameworkName?: string
  frameworkTemplate?: string
  tags?: string[]
  typographyStyle?: {
    summary?: string
    boldUsage?: 'none' | 'rich_text' | 'unicode' | 'markdown' | 'mixed'
    boldSamples?: string[]
    carryForwardRules?: string[]
    lineBreakStyle?: string
    listStyle?: string
    attributeTypes?: string[]
  }
  typesettingStyle?: CatalogEntry['typographyStyle']
  catalogSource?: 'swipe' | 'remote' | 'legacy'
}

let catalogCache: {
  swipeMtime: number
  indexMtime: number
  cacheMtime: number
  entries: CatalogEntry[]
  catalogSource: 'swipe' | 'legacy'
} | null = null

let remoteCatalogCache: {
  checkedAt: number
  entries: CatalogEntry[] | null
  error: string | null
} | null = null

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

type SwipeJsonEntry = Record<string, unknown>

function normalizeTypographyStyle(value: unknown): CatalogEntry['typographyStyle'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    boldUsage:
      raw.boldUsage === 'none' ||
      raw.boldUsage === 'rich_text' ||
      raw.boldUsage === 'unicode' ||
      raw.boldUsage === 'markdown' ||
      raw.boldUsage === 'mixed'
        ? raw.boldUsage
        : undefined,
    boldSamples: Array.isArray(raw.boldSamples) ? raw.boldSamples.map(String) : undefined,
    carryForwardRules: Array.isArray(raw.carryForwardRules) ? raw.carryForwardRules.map(String) : undefined,
    lineBreakStyle: typeof raw.lineBreakStyle === 'string' ? raw.lineBreakStyle : undefined,
    listStyle: typeof raw.listStyle === 'string' ? raw.listStyle : undefined,
    attributeTypes: Array.isArray(raw.attributeTypes) ? raw.attributeTypes.map(String) : undefined,
  }
}

function entriesFromSwipePayload(
  payload: { entries?: SwipeJsonEntry[] },
  catalogSource: 'swipe' | 'remote',
): CatalogEntry[] | null {
  try {
    const list = Array.isArray(payload.entries) ? payload.entries : []
    if (list.length === 0) return null
    return list
      .map((e): CatalogEntry | null => {
        const urn = String(e.urn || e.id || '')
        if (!urn) return null
        const postBody = String(e.postBody || '')
        const typographyStyle = normalizeTypographyStyle(e.typographyStyle || e.typesettingStyle)
        return {
          id: urn,
          urn,
          creator: String(e.creator || ''),
          slug: String(e.slug || ''),
          hook: String(e.hook || ''),
          url: String(e.url || ''),
          axes: String(e.axes || e.engagementHeader || ''),
          formatTags: Array.isArray(e.formatTags)
            ? (e.formatTags as unknown[]).map(String)
            : e.formatLevel
              ? String(e.formatLevel)
                  .split(/[,/]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [],
          structuralTags: Array.isArray(e.structuralTags)
            ? (e.structuralTags as unknown[]).map(String)
            : e.structural
              ? String(e.structural)
                  .split(/[,/]/)
                  .map((t) => t.trim())
                  .filter((t) => t && t !== '_(not tagged)_')
              : [],
          searchText: String(e.searchText || ''),
          hasFramework: Boolean(e.hasFramework),
          frameworkBody: String(e.frameworkBody || ''),
          postBody,
          textPreview: String(e.textPreview || postBody).slice(0, 280),
          maxRatio: typeof e.maxRatio === 'number' ? e.maxRatio : 0,
          frameworkName: e.frameworkName ? String(e.frameworkName) : undefined,
          frameworkTemplate: e.frameworkTemplate ? String(e.frameworkTemplate) : undefined,
          tags: Array.isArray(e.tags) ? (e.tags as unknown[]).map(String) : undefined,
          typographyStyle,
          typesettingStyle: typographyStyle,
          catalogSource,
        }
      })
      .filter((x): x is CatalogEntry => x !== null)
  } catch {
    return null
  }
}

function loadSwipeCatalogEntries(): CatalogEntry[] | null {
  if (!fs.existsSync(SWIPE_CATALOG)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(SWIPE_CATALOG, 'utf8')) as { entries?: SwipeJsonEntry[] }
    return entriesFromSwipePayload(raw, 'swipe')
  } catch {
    return null
  }
}

function buildLegacyCatalog(): CatalogEntry[] {
  if (!fs.existsSync(OUTLIERS_INDEX)) return []

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
        catalogSource: 'legacy',
      })
    }
  }

  entries.sort((a, b) => b.maxRatio - a.maxRatio)
  return entries
}

function remoteCatalogConfig(): { url: string; serviceKey: string; bucket: string; objectPath: string } | null {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const bucket = process.env.OUTLIERS_CATALOG_BUCKET || ''
  const objectPath = process.env.OUTLIERS_CATALOG_PATH || ''
  if (!url || !serviceKey || !bucket || !objectPath) return null
  return { url, serviceKey, bucket, objectPath }
}

function storageObjectUrl(cfg: { url: string; bucket: string; objectPath: string }): string {
  const encodedPath = cfg.objectPath.split('/').map(encodeURIComponent).join('/')
  return `${cfg.url}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${encodedPath}`
}

async function loadRemoteCatalogEntries(): Promise<CatalogEntry[] | null> {
  const cfg = remoteCatalogConfig()
  if (!cfg) return null

  const now = Date.now()
  if (remoteCatalogCache && now - remoteCatalogCache.checkedAt < REMOTE_CATALOG_TTL_MS) {
    return remoteCatalogCache.entries
  }

  try {
    const res = await fetch(storageObjectUrl(cfg), {
      headers: {
        Authorization: `Bearer ${cfg.serviceKey}`,
        apikey: cfg.serviceKey,
      },
    })
    if (res.status === 404) {
      remoteCatalogCache = { checkedAt: now, entries: null, error: null }
      return null
    }
    if (!res.ok) throw new Error(`remote catalog HTTP ${res.status}`)
    const payload = (await res.json()) as { entries?: SwipeJsonEntry[] }
    const entries = entriesFromSwipePayload(payload, 'remote')
    remoteCatalogCache = { checkedAt: now, entries, error: null }
    return entries
  } catch (e) {
    remoteCatalogCache = { checkedAt: now, entries: null, error: String(e) }
    return null
  }
}

/**
 * Swipe catalog (cleaned markdown) when present; otherwise index + framework cache.
 */
function buildOutliersCatalog(): { entries: CatalogEntry[]; catalogSource: 'swipe' | 'legacy' } {
  const swipeSt = fs.existsSync(SWIPE_CATALOG) ? fs.statSync(SWIPE_CATALOG) : { mtimeMs: 0 }
  const iSt = fs.existsSync(OUTLIERS_INDEX) ? fs.statSync(OUTLIERS_INDEX) : { mtimeMs: 0 }
  const cSt = fs.existsSync(OUTLIER_FW_CACHE) ? fs.statSync(OUTLIER_FW_CACHE) : { mtimeMs: 0 }

  if (
    catalogCache &&
    catalogCache.swipeMtime === swipeSt.mtimeMs &&
    catalogCache.indexMtime === iSt.mtimeMs &&
    catalogCache.cacheMtime === cSt.mtimeMs
  ) {
    return { entries: catalogCache.entries, catalogSource: catalogCache.catalogSource }
  }

  const swipeEntries = loadSwipeCatalogEntries()
  if (swipeEntries && swipeEntries.length > 0) {
    swipeEntries.sort((a, b) => b.maxRatio - a.maxRatio || b.postBody.length - a.postBody.length)
    catalogCache = {
      swipeMtime: swipeSt.mtimeMs,
      indexMtime: iSt.mtimeMs,
      cacheMtime: cSt.mtimeMs,
      entries: swipeEntries,
      catalogSource: 'swipe',
    }
    return { entries: swipeEntries, catalogSource: 'swipe' }
  }

  const legacy = buildLegacyCatalog()
  catalogCache = {
    swipeMtime: swipeSt.mtimeMs,
    indexMtime: iSt.mtimeMs,
    cacheMtime: cSt.mtimeMs,
    entries: legacy,
    catalogSource: 'legacy',
  }
  return { entries: legacy, catalogSource: 'legacy' }
}

async function buildOutliersCatalogAsync(): Promise<{ entries: CatalogEntry[]; catalogSource: 'swipe' | 'remote' | 'legacy' }> {
  const remoteEntries = await loadRemoteCatalogEntries()
  if (remoteEntries && remoteEntries.length > 0) {
    remoteEntries.sort((a, b) => b.maxRatio - a.maxRatio || b.postBody.length - a.postBody.length)
    return { entries: remoteEntries, catalogSource: 'remote' }
  }
  return buildOutliersCatalog()
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
        sendJson(res, { text, source: 'data/os/Style Guide/vantum_style_guide.md' })
        return
      }
      if (!fs.existsSync(STYLE_GUIDE_HTML)) {
        sendJson(res, { text: '', error: 'missing_style_guide', path: STYLE_GUIDE_HTML })
        return
      }
      const html = fs.readFileSync(STYLE_GUIDE_HTML, 'utf8')
      sendJson(res, { text: htmlToPlainText(html), source: 'data/os/Style Guide/vantum_pdf_design_system_v2.html' })
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
    sendJson(res, { id, text: fs.readFileSync(fp, 'utf8'), source: `data/os/Voices/${file}` })
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
    sendJson(res, { id, text: fs.readFileSync(fp, 'utf8'), source: `data/os/Customer Personas/${file}` })
    return
  }

  if (pathname === '/api/outliers-catalog') {
    void buildOutliersCatalogAsync()
      .then(({ entries, catalogSource }) => {
        const remoteCfg = remoteCatalogConfig()
        sendJson(res, {
          count: entries.length,
          entries,
          catalogSource,
          swipeCatalogPath: SWIPE_CATALOG,
          remoteCatalogPath: remoteCfg ? `${remoteCfg.bucket}/${remoteCfg.objectPath}` : '',
          remoteCatalogError: remoteCatalogCache?.error ?? '',
          indexPath: OUTLIERS_INDEX,
          cachePath: OUTLIER_FW_CACHE,
        })
      })
      .catch((e) => {
        sendJson(res, { error: String(e), entries: [] }, 500)
      })
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
