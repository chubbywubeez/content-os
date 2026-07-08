import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApifyClient } from 'apify-client'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEEDS_PATH = path.join(__dirname, 'seed-influencers.json')
const ACTOR_ID = 'Wpp1BZ6yGWjySadk3'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_CONTENT_OS_URL = 'https://content-os-production-9015.up.railway.app'

function loadEnvFromAncestors() {
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    const envPath = path.join(dir, '.env')
    if (fs.existsSync(envPath)) {
      for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) continue
        const idx = line.indexOf('=')
        const key = line.slice(0, idx).trim()
        const val = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
        if (key && process.env[key] === undefined) process.env[key] = val
      }
      return
    }
    const next = path.dirname(dir)
    if (next === dir) return
    dir = next
  }
}

function parseArgs() {
  const out = {
    dryRun: false,
    noUpload: false,
    maxProfiles: null,
    postLimit: null,
    targetMax: null,
    targetMin: null,
  }
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') out.dryRun = true
    else if (arg === '--no-upload') out.noUpload = true
    else if (arg.startsWith('--max-profiles=')) out.maxProfiles = Number(arg.split('=')[1])
    else if (arg.startsWith('--post-limit=')) out.postLimit = Number(arg.split('=')[1])
    else if (arg.startsWith('--target-max=')) out.targetMax = Number(arg.split('=')[1])
    else if (arg.startsWith('--target-min=')) out.targetMin = Number(arg.split('=')[1])
  }
  return out
}

function intEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name]
  const n = raw == null || raw === '' ? fallback : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function numberEnv(name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = process.env[name]
  const n = raw == null || raw === '' ? fallback : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function boolEnv(name, fallback = false) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  return /^(1|true|yes|on)$/i.test(raw)
}

function configFromEnv(args) {
  const targetMax = args.targetMax ?? intEnv('OUTLIER_CRON_TARGET_MAX', 60, { min: 1, max: 100 })
  return {
    dryRun: args.dryRun || boolEnv('OUTLIER_CRON_DRY_RUN', false),
    noUpload: args.noUpload,
    contentOsUrl: (process.env.CONTENT_OS_BASE_URL || process.env.RAILWAY_SERVICE_CONTENT_OS_URL || DEFAULT_CONTENT_OS_URL).replace(/\/+$/, ''),
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: process.env.OUTLIERS_CATALOG_BUCKET || 'content-os',
    catalogPath: process.env.OUTLIERS_CATALOG_PATH || 'outliers/outliers_swipe_catalog.json',
    discoveryPath: process.env.OUTLIERS_DISCOVERY_PATH || 'outliers/discovered_influencers.json',
    apifyToken: process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN || '',
    openRouterKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OUTLIER_CRON_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.6',
    maxProfiles: args.maxProfiles ?? intEnv('OUTLIER_CRON_MAX_PROFILES', 5, { min: 0, max: 20 }),
    seedProfilesPerRun: intEnv('OUTLIER_CRON_SEED_PROFILES_PER_RUN', 4, { min: 0, max: 20 }),
    discoveryProfilesPerRun: intEnv('OUTLIER_CRON_DISCOVERY_PROFILES_PER_RUN', 1, { min: 0, max: 10 }),
    discoveryCooldownDays: intEnv('OUTLIER_CRON_DISCOVERY_COOLDOWN_DAYS', 14, { min: 0, max: 365 }),
    postLimit: args.postLimit ?? intEnv('OUTLIER_CRON_POST_LIMIT', 60, { min: 1, max: 250 }),
    outlierMultiplier: numberEnv('OUTLIER_CRON_OUTLIER_MULTIPLIER', 3, { min: 1.5, max: 20 }),
    minEngagementScore: intEnv('OUTLIER_CRON_MIN_ENGAGEMENT_SCORE', 75, { min: 0, max: 1000000 }),
    targetMin: args.targetMin ?? intEnv('OUTLIER_CRON_TARGET_MIN', 10, { min: 0, max: 100 }),
    targetMax,
    includeTopFallback: boolEnv('OUTLIER_CRON_INCLUDE_TOP_FALLBACK', true),
  }
}

function requireRuntimeConfig(cfg) {
  if (cfg.maxProfiles === 0 || cfg.dryRun) return
  const missing = []
  if (!cfg.apifyToken) missing.push('APIFY_TOKEN or APIFY_API_TOKEN')
  if (!cfg.openRouterKey) missing.push('OPENROUTER_API_KEY')
  if (!cfg.supabaseUrl) missing.push('SUPABASE_URL')
  if (!cfg.supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length) {
    throw new Error(`Missing required env for cron persistence: ${missing.join(', ')}`)
  }
}

function loadSeeds() {
  return JSON.parse(fs.readFileSync(SEEDS_PATH, 'utf8'))
}

function createSupabase(cfg) {
  if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) return null
  return createClient(cfg.supabaseUrl, cfg.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function ensureBucket(supabase, bucket) {
  const { data, error } = await supabase.storage.getBucket(bucket)
  if (!error && data) return
  const { error: createError } = await supabase.storage.createBucket(bucket, { public: false })
  if (createError && !/already exists/i.test(createError.message || '')) {
    throw new Error(`Supabase bucket create failed: ${createError.message}`)
  }
}

async function downloadJsonObject(supabase, bucket, objectPath) {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(bucket).download(objectPath)
  if (error) return null
  const text = await data.text()
  return JSON.parse(text)
}

async function uploadJsonObject(supabase, bucket, objectPath, payload) {
  await ensureBucket(supabase, bucket)
  const body = JSON.stringify(payload, null, 2)
  const { error } = await supabase.storage.from(bucket).upload(objectPath, body, {
    upsert: true,
    contentType: 'application/json; charset=utf-8',
  })
  if (error) throw new Error(`Supabase upload failed for ${objectPath}: ${error.message}`)
}

async function fetchProductionCatalog(cfg) {
  const res = await fetch(`${cfg.contentOsUrl}/api/outliers-catalog`, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`Content OS catalog fetch failed: HTTP ${res.status}`)
  const body = await res.json()
  const entries = Array.isArray(body.entries) ? body.entries : []
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    source: body.catalogSource || 'content-os-api',
    sourceFiles: [],
    creators: summarizeCreators(entries),
    count: entries.length,
    entries,
  }
}

function normalizeCatalogPayload(payload) {
  const entries = Array.isArray(payload?.entries) ? payload.entries : []
  return {
    version: Number(payload?.version || 2),
    generatedAt: payload?.generatedAt || new Date().toISOString(),
    source: payload?.source || 'railway-cron',
    sourceFiles: Array.isArray(payload?.sourceFiles) ? payload.sourceFiles : [],
    creators: Array.isArray(payload?.creators) ? payload.creators : summarizeCreators(entries),
    count: entries.length,
    entries,
    dailyRefresh: payload?.dailyRefresh || null,
  }
}

async function loadBaseCatalog(cfg, supabase) {
  const remote = await downloadJsonObject(supabase, cfg.bucket, cfg.catalogPath)
  if (remote?.entries) return { catalog: normalizeCatalogPayload(remote), source: 'supabase' }
  return { catalog: await fetchProductionCatalog(cfg), source: 'content-os-api' }
}

function emptyDiscoveryState(seeds) {
  const knownInfluencers = {}
  for (const seed of seeds) {
    knownInfluencers[seed.slug] = {
      name: seed.name,
      slug: seed.slug,
      source: 'seed',
      score: 100,
      appearances: 0,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      lastScrapedAt: null,
    }
  }
  return { version: 1, updatedAt: new Date().toISOString(), knownInfluencers, runs: [] }
}

async function loadDiscoveryState(cfg, supabase, seeds) {
  const remote = await downloadJsonObject(supabase, cfg.bucket, cfg.discoveryPath)
  const state = remote?.knownInfluencers ? remote : emptyDiscoveryState(seeds)
  for (const seed of seeds) {
    state.knownInfluencers[seed.slug] = {
      ...state.knownInfluencers[seed.slug],
      name: seed.name,
      slug: seed.slug,
      source: 'seed',
      score: Math.max(100, Number(state.knownInfluencers[seed.slug]?.score || 0)),
    }
  }
  return state
}

function daysSince(iso) {
  if (!iso) return Infinity
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return Infinity
  return (Date.now() - t) / 86_400_000
}

function selectProfiles({ seeds, state, cfg }) {
  const selected = []
  const seen = new Set()
  const day = Math.floor(Date.now() / 86_400_000)
  const seedSlots = Math.min(cfg.seedProfilesPerRun, cfg.maxProfiles)

  for (let i = 0; i < seeds.length && selected.length < seedSlots; i++) {
    const seed = seeds[(day + i) % seeds.length]
    selected.push({ ...seed, source: 'seed' })
    seen.add(seed.slug)
  }

  const discoverySlots = Math.min(cfg.discoveryProfilesPerRun, cfg.maxProfiles - selected.length)
  const discovered = Object.values(state.knownInfluencers || {})
    .filter((row) => row.source !== 'seed')
    .filter((row) => row.slug && !seen.has(row.slug))
    .filter((row) => daysSince(row.lastScrapedAt) >= cfg.discoveryCooldownDays)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))

  for (const row of discovered.slice(0, discoverySlots)) {
    selected.push({ name: row.name || row.slug, slug: row.slug, source: 'discovered' })
    seen.add(row.slug)
  }

  return selected.slice(0, cfg.maxProfiles)
}

function profileUrl(slug) {
  return `https://www.linkedin.com/in/${slug}/`
}

function slugFromLinkedinUrl(value) {
  const m = String(value || '').match(/linkedin\.com\/in\/([^/?#]+)/i)
  return m ? m[1].toLowerCase() : ''
}

async function scrapeProfiles(client, profiles, cfg) {
  if (profiles.length === 0) return new Map()
  const input = {
    urls: profiles.map((p) => profileUrl(p.slug)),
    deepScrape: false,
    rawData: false,
    limitPerSource: cfg.postLimit,
  }
  console.log(`Apify scrape: ${profiles.length} profile(s), limitPerSource=${cfg.postLimit}`)
  const run = await client.actor(ACTOR_ID).call(input, { waitSecs: 3600 })
  const all = []
  let offset = 0
  const limit = 1000
  while (true) {
    const page = await client.dataset(run.defaultDatasetId).listItems({ offset, limit })
    all.push(...page.items)
    if (page.items.length < limit) break
    offset += page.items.length
  }

  const grouped = new Map(profiles.map((p) => [p.slug, []]))
  for (const item of all) {
    const blob = JSON.stringify(item).toLowerCase()
    let matched = profiles.find((p) => blob.includes(`/in/${p.slug.toLowerCase()}/`))
    if (!matched) {
      const fromUrl = slugFromLinkedinUrl(item.url || item.postLink || item.link || '')
      matched = profiles.find((p) => p.slug.toLowerCase() === fromUrl)
    }
    if (matched) grouped.get(matched.slug).push(item)
  }
  return grouped
}

function asNumber(...values) {
  for (const value of values) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function getText(item) {
  return String(item.text || item.commentary || item.description || item.caption || '').replace(/\r\n/g, '\n')
}

function getEngagement(item) {
  return {
    likes: asNumber(item.numLikes, item.likeCount, item.likes, item.reactionCount, item.totalReactionCount) ?? 0,
    comments: asNumber(item.numComments, item.commentCount, item.commentsCount, item.commentsTotal, item.comments?.length) ?? 0,
    shares: asNumber(item.numShares, item.shareCount, item.shares, item.reposts, item.repostCount) ?? 0,
  }
}

function extractHook(text) {
  const line = text
    .split(/\n+/)
    .map((s) => s.trim())
    .find(Boolean)
  return line || text.slice(0, 140).trim()
}

function lengthTier(text) {
  if (text.length < 400) return 'Short'
  if (text.length < 1500) return 'Medium'
  return 'Long'
}

function formatTagsForPost(item, text) {
  const tags = new Set(['LinkedIn Post'])
  const type = String(item.type || '').toLowerCase()
  if (type.includes('document')) tags.add('Deck')
  if (type.includes('video')) tags.add('LinkedIn Video')
  if ((item.images?.length || 0) > 0) tags.add('Image Post')
  if (text.length < 280 && text.split(/\n/).filter(Boolean).length <= 3) tags.add('Atomic Essay')
  return [...tags]
}

function structuralTagsForText(text) {
  const tags = new Set()
  const listLines = text.split('\n').filter((line) => /^\s*(\d+[.)]|[-*]|[->]+|[a-z][.)])\s+/i.test(line)).length
  if (listLines >= 3) tags.add('List post')
  if (/\b(here'?s how|step \d|framework|playbook|checklist|process)\b/i.test(text)) tags.add('How-to / Framework post')
  if (/\b(i learned|years ago|when i|story|fast forward)\b/i.test(text) && text.length > 350) tags.add('Story post')
  if (/\b(unpopular|hot take|most people|everyone|stop doing|wrong)\b/i.test(text)) tags.add('Observation / Contrarian take')
  if (/[?]\s*$/.test(text.trim()) || /^.{1,120}[?]\s*$/m.test(text)) tags.add('Question post')
  if (text.length < 220 && text.split(/\n/).filter(Boolean).length <= 3) tags.add('One-liner / Punch')
  return [...tags]
}

function normalizePost(item, slug, creator) {
  const text = getText(item)
  const engagement = getEngagement(item)
  const url = String(item.url || item.postLink || item.link || '').trim()
  const urn = String(item.urn || item.activityUrn || item.id || url).trim()
  return {
    slug,
    creator,
    urn,
    url,
    hook: extractHook(text),
    text,
    textPreview: text.slice(0, 280),
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    score: engagement.likes + engagement.comments * 2 + engagement.shares * 3,
    formatTags: formatTagsForPost(item, text),
    structuralTags: structuralTagsForText(text),
    lengthTier: lengthTier(text),
    charCount: text.length,
    raw: item,
  }
}

function mean(nums) {
  const vals = nums.filter((n) => Number.isFinite(n) && n >= 0)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function findOutliers(posts, cfg) {
  const meanLikes = mean(posts.map((p) => p.likes))
  const meanComments = mean(posts.map((p) => p.comments))
  const meanShares = mean(posts.map((p) => p.shares))
  const outliers = []
  for (const p of posts) {
    const ratios = {
      likes: meanLikes > 0 ? p.likes / meanLikes : 0,
      comments: meanComments > 0 ? p.comments / meanComments : 0,
      shares: meanShares > 0 ? p.shares / meanShares : 0,
    }
    const axes = Object.entries(ratios)
      .filter(([, ratio]) => ratio >= cfg.outlierMultiplier)
      .map(([axis]) => axis)
    const maxRatio = Math.max(ratios.likes, ratios.comments, ratios.shares)
    if (axes.length > 0 && p.score >= cfg.minEngagementScore && p.text.trim().length >= 40) {
      outliers.push({ ...p, ratios, axes, maxRatio, fallbackTopPost: false })
    }
  }

  if (cfg.includeTopFallback && outliers.length < cfg.targetMin) {
    const seen = new Set(outliers.map((p) => p.urn))
    const top = posts
      .filter((p) => !seen.has(p.urn))
      .filter((p) => p.score >= cfg.minEngagementScore && p.text.trim().length >= 80)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, cfg.targetMin - outliers.length))
      .map((p) => ({ ...p, ratios: { likes: 0, comments: 0, shares: 0 }, axes: ['top'], maxRatio: 1, fallbackTopPost: true }))
    outliers.push(...top)
  }

  return outliers.sort((a, b) => b.maxRatio - a.maxRatio || b.score - a.score)
}

function codePointIsStyled(cp) {
  return cp >= 0x1d400 && cp <= 0x1d7ff
}

function uniqueStrings(values) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))]
}

function getAttributeType(attr) {
  return String(attr?.type || attr?.name || attr?.attributeType || attr?.style || '').trim()
}

function getAttributeSample(text, attr) {
  const start = asNumber(attr?.start, attr?.startIndex, attr?.offset)
  const len = asNumber(attr?.length, attr?.len)
  if (start == null || len == null || len <= 0) return ''
  return text.slice(start, start + len).trim()
}

function detectListStyle(text) {
  const numbered = (text.match(/^\s*\d+[.)]\s+/gm) || []).length
  const bullets = (text.match(/^\s*[-*]\s+/gm) || []).length
  const arrows = (text.match(/^\s*(->|=>)\s+/gm) || []).length
  if (numbered >= 3) return 'numbered list'
  if (bullets >= 3) return 'bullet list'
  if (arrows >= 3) return 'arrow list'
  return 'none'
}

function analyzeTypography(text, raw) {
  const chars = Array.from(text)
  const styledChars = chars.filter((ch) => codePointIsStyled(ch.codePointAt(0) || 0)).length
  const unicodeSamples = uniqueStrings(text.match(/[\u{1d400}-\u{1d7ff}][\u{1d400}-\u{1d7ff}\s]{0,80}/gu) || []).slice(0, 4)
  const markdownSamples = uniqueStrings((text.match(/\*\*[^*]{1,120}\*\*/g) || []).map((s) => s.replace(/\*\*/g, ''))).slice(0, 4)
  const attributes = Array.isArray(raw?.attributes) ? raw.attributes : []
  const attributeTypes = uniqueStrings(attributes.map(getAttributeType))
  const richBoldSamples = uniqueStrings(
    attributes
      .filter((attr) => /bold|strong/i.test(getAttributeType(attr)))
      .map((attr) => getAttributeSample(text, attr)),
  ).slice(0, 4)
  const boldSignals = [
    richBoldSamples.length ? 'rich_text' : '',
    unicodeSamples.length || styledChars > 0 ? 'unicode' : '',
    markdownSamples.length ? 'markdown' : '',
  ].filter(Boolean)
  const boldUsage = boldSignals.length > 1 ? 'mixed' : boldSignals[0] || 'none'
  const nonEmptyLines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const shortLines = nonEmptyLines.filter((l) => l.length <= 80).length
  const listStyle = detectListStyle(text)
  const lineBreakStyle =
    nonEmptyLines.length <= 2
      ? 'compact'
      : shortLines / Math.max(1, nonEmptyLines.length) > 0.7
        ? 'short-line cadence'
        : 'paragraph blocks'

  const carryForwardRules = []
  if (boldUsage !== 'none') {
    carryForwardRules.push('Carry over the same emphasis pattern: bold or styled text should mark the hook, key contrast, or payoff, not random words.')
  } else {
    carryForwardRules.push('Keep emphasis plain unless the generated idea needs one clearly marked hook or payoff phrase.')
  }
  if (listStyle !== 'none') carryForwardRules.push(`Preserve the source list behavior as a ${listStyle}.`)
  carryForwardRules.push(`Preserve the source line-break feel: ${lineBreakStyle}.`)

  const summaryParts = [
    `bold=${boldUsage}`,
    `lineBreaks=${lineBreakStyle}`,
    `list=${listStyle}`,
    attributeTypes.length ? `attributes=${attributeTypes.join(', ')}` : '',
  ].filter(Boolean)

  return {
    summary: summaryParts.join('; '),
    boldUsage,
    boldSamples: uniqueStrings([...richBoldSamples, ...unicodeSamples, ...markdownSamples]).slice(0, 6),
    carryForwardRules,
    lineBreakStyle,
    listStyle,
    attributeTypes,
  }
}

function discoverInfluencersFromItems(items, state, sourceSlug) {
  const now = new Date().toISOString()
  let addedOrUpdated = 0
  for (const item of items) {
    const profiles = []
    for (const c of Array.isArray(item.comments) ? item.comments : []) {
      if (c?.author) profiles.push(c.author)
      for (const ent of Array.isArray(c?.entities) ? c.entities : []) {
        if (ent?.profile) profiles.push(ent.profile)
      }
    }
    for (const attr of Array.isArray(item.attributes) ? item.attributes : []) {
      if (attr?.profile) profiles.push(attr.profile)
    }
    for (const profile of profiles) {
      const slug = String(profile.publicId || profile.publicIdentifier || '').toLowerCase().trim()
      if (!slug || slug === sourceSlug) continue
      const name = [profile.firstName, profile.lastName].map((x) => String(x || '').trim()).filter(Boolean).join(' ') || slug
      const occupation = String(profile.occupation || profile.headline || '')
      const quality =
        /\b(founder|creator|writer|author|speaker|newsletter|content|copywriter|ghostwriter|marketing|brand|growth|ceo|entrepreneur|operator)\b/i.test(occupation)
          ? 5
          : 1
      const existing = state.knownInfluencers[slug] || {}
      state.knownInfluencers[slug] = {
        ...existing,
        name,
        slug,
        occupation,
        source: existing.source === 'seed' ? 'seed' : 'discovered',
        score: Number(existing.score || 0) + quality,
        appearances: Number(existing.appearances || 0) + 1,
        firstSeenAt: existing.firstSeenAt || now,
        lastSeenAt: now,
        discoveredFrom: uniqueStrings([
          ...(Array.isArray(existing.discoveredFrom) ? existing.discoveredFrom : []),
          sourceSlug,
        ]).slice(0, 20),
        lastScrapedAt: existing.lastScrapedAt || null,
      }
      addedOrUpdated += 1
    }
  }
  return addedOrUpdated
}

function safeJsonParseModel(text) {
  let raw = String(text || '').trim()
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(raw)
}

function slugTag(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function extractFramework(post, cfg) {
  const typographyStyle = analyzeTypography(post.text, post.raw)
  const payload = {
    creator: post.creator,
    slug: post.slug,
    hook: post.hook,
    url: post.url,
    urn: post.urn,
    engagement: { likes: post.likes, comments: post.comments, shares: post.shares },
    outlier: { axes: post.axes, maxRatio: post.maxRatio, fallbackTopPost: post.fallbackTopPost },
    formatTags: post.formatTags,
    structuralTags: post.structuralTags,
    typographyStyle,
    postText: post.text,
  }

  const user = `Reverse-engineer this LinkedIn post into a reusable Content OS framework.

Return ONLY strict JSON with this shape:
{
  "frameworkName": "mechanism name, not topic name",
  "oneLineEssence": "12 words or fewer",
  "frameworkTemplate": "fill-in template with bracketed FORM slots",
  "frameworkNote": "one sentence on the mechanism",
  "formatTags": ["LinkedIn Post"],
  "structuralTags": ["List post"],
  "tags": ["lowercase-hyphen-tags"],
  "typographyStyle": {
    "summary": "short source typography summary",
    "boldUsage": "none|rich_text|unicode|markdown|mixed",
    "boldSamples": ["samples if present"],
    "carryForwardRules": ["rules for using bold/rich text, line breaks, lists, spacing"],
    "lineBreakStyle": "short phrase",
    "listStyle": "short phrase",
    "attributeTypes": ["attribute type names if present"]
  }
}

LinkedIn typography matters. If the source has bold/rich text, Unicode styled characters, short-line cadence, list markers, or special spacing, capture the style and reflect it inside frameworkTemplate and typographyStyle.carryForwardRules. Do not copy source facts, names, stories, or claims into the template.

Input:
${JSON.stringify(payload, null, 2)}`

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': cfg.contentOsUrl,
      'X-Title': 'Content OS daily outlier refresh',
    },
    body: JSON.stringify({
      model: cfg.openRouterModel,
      messages: [
        {
          role: 'system',
          content:
            'You are a content architecture analyst. Extract reusable structure, not topic summary. Output valid JSON only.',
        },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter HTTP ${res.status}: ${err.slice(0, 500)}`)
  }
  const body = await res.json()
  const content = body?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter returned empty content')
  const parsed = safeJsonParseModel(content)
  const modelTypography = parsed.typographyStyle && typeof parsed.typographyStyle === 'object' ? parsed.typographyStyle : {}
  return {
    frameworkName: String(parsed.frameworkName || 'Unnamed framework').trim(),
    oneLineEssence: String(parsed.oneLineEssence || '').trim(),
    frameworkTemplate: String(parsed.frameworkTemplate || '').trim(),
    frameworkNote: String(parsed.frameworkNote || '').trim(),
    formatTags: Array.isArray(parsed.formatTags) ? parsed.formatTags.map(String) : post.formatTags,
    structuralTags: Array.isArray(parsed.structuralTags) ? parsed.structuralTags.map(String) : post.structuralTags,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(slugTag).filter(Boolean) : [],
    typographyStyle: {
      ...typographyStyle,
      ...modelTypography,
      boldSamples: uniqueStrings([...(typographyStyle.boldSamples || []), ...(modelTypography.boldSamples || [])]).slice(0, 6),
      carryForwardRules: uniqueStrings([
        ...(typographyStyle.carryForwardRules || []),
        ...(modelTypography.carryForwardRules || []),
      ]).slice(0, 8),
      attributeTypes: uniqueStrings([...(typographyStyle.attributeTypes || []), ...(modelTypography.attributeTypes || [])]),
    },
  }
}

function engagementHeader(post) {
  if (post.fallbackTopPost) return `Top engagement post - score ${post.score}`
  const parts = []
  for (const axis of post.axes) {
    const count = axis === 'likes' ? post.likes : axis === 'comments' ? post.comments : post.shares
    const ratio = post.ratios?.[axis] || post.maxRatio
    parts.push(`${axis} outlier - ${count.toLocaleString('en-US')} ~= ${ratio.toFixed(2)}x mean`)
  }
  return parts.join(' | ')
}

function buildFrameworkBody(extracted) {
  const rules = Array.isArray(extracted.typographyStyle?.carryForwardRules)
    ? extracted.typographyStyle.carryForwardRules
    : []
  return [
    `Framework mechanism: "${extracted.frameworkName}"`,
    '',
    'Fill-in template:',
    extracted.frameworkTemplate,
    extracted.frameworkNote ? ['', `Mechanism note: ${extracted.frameworkNote}`].join('\n') : '',
    '',
    'Typography / typesetting style:',
    `Summary: ${extracted.typographyStyle?.summary || 'plain'}`,
    `Bold usage: ${extracted.typographyStyle?.boldUsage || 'none'}`,
    rules.length ? `Carry forward: ${rules.join(' | ')}` : '',
    extracted.tags?.length ? `Tags: ${extracted.tags.join(', ')}` : '',
  ]
    .filter((part) => String(part).trim().length > 0)
    .join('\n')
}

function makeCatalogEntry(post, extracted) {
  const tags = uniqueStrings([
    `writer:${slugTag(post.slug)}`,
    ...extracted.tags,
    ...extracted.formatTags.map(slugTag),
    ...extracted.structuralTags.map(slugTag),
  ]).filter(Boolean)
  const frameworkBody = buildFrameworkBody({ ...extracted, tags })
  return {
    id: post.urn,
    urn: post.urn,
    creator: post.creator,
    slug: post.slug,
    writerTag: slugTag(post.slug),
    engagementHeader: engagementHeader(post),
    hook: post.hook,
    url: post.url,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    formatLevel: extracted.formatTags.join(', '),
    structural: extracted.structuralTags.join(', '),
    lengthTier: post.lengthTier,
    charCount: post.charCount,
    postBody: post.text,
    frameworkName: extracted.frameworkName,
    frameworkTemplate: extracted.frameworkTemplate,
    frameworkNote: extracted.frameworkNote,
    typographyStyle: extracted.typographyStyle,
    typesettingStyle: extracted.typographyStyle,
    tags,
    frameworkBody,
    hasFramework: extracted.frameworkTemplate.trim().length >= 40,
    searchText: [
      post.creator,
      post.slug,
      post.hook,
      post.urn,
      extracted.frameworkName,
      extracted.frameworkTemplate,
      extracted.frameworkNote,
      extracted.typographyStyle?.summary,
      ...tags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
    maxRatio: post.maxRatio,
    sourceFile: 'railway-cron',
    formatTags: extracted.formatTags,
    structuralTags: extracted.structuralTags,
    textPreview: post.textPreview,
    axes: engagementHeader(post),
    catalogSource: 'remote',
    discoveredAt: new Date().toISOString(),
  }
}

function summarizeCreators(entries) {
  const bySlug = new Map()
  for (const entry of entries) {
    const slug = String(entry.slug || '').trim()
    if (!slug) continue
    const prev = bySlug.get(slug) || { slug, creator: entry.creator || slug, file: entry.sourceFile || 'catalog', count: 0 }
    prev.count += 1
    bySlug.set(slug, prev)
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

function mergeCatalog(catalog, newEntries, runSummary) {
  const byUrn = new Map()
  for (const entry of catalog.entries || []) {
    const urn = String(entry.urn || entry.id || '')
    if (urn) byUrn.set(urn, entry)
  }
  for (const entry of newEntries) byUrn.set(entry.urn, entry)
  const entries = [...byUrn.values()].sort((a, b) => Number(b.maxRatio || 0) - Number(a.maxRatio || 0))
  return {
    ...catalog,
    version: 2,
    generatedAt: new Date().toISOString(),
    source: 'supabase/outlier-cron',
    sourceFiles: uniqueStrings([...(catalog.sourceFiles || []), 'railway-cron']),
    creators: summarizeCreators(entries),
    count: entries.length,
    entries,
    dailyRefresh: runSummary,
  }
}

async function main() {
  loadEnvFromAncestors()
  const args = parseArgs()
  const cfg = configFromEnv(args)
  requireRuntimeConfig(cfg)

  const seeds = loadSeeds()
  const supabase = createSupabase(cfg)
  const { catalog, source: catalogSource } = await loadBaseCatalog(cfg, supabase)
  const discoveryState = await loadDiscoveryState(cfg, supabase, seeds)
  const selectedProfiles = selectProfiles({ seeds, state: discoveryState, cfg })
  const existingUrns = new Set((catalog.entries || []).map((entry) => String(entry.urn || entry.id || '')))

  console.log(`Catalog source: ${catalogSource}; entries=${catalog.entries.length}`)
  console.log(`Selected profiles: ${selectedProfiles.map((p) => `${p.slug}:${p.source}`).join(', ') || '(none)'}`)

  const runSummary = {
    ranAt: new Date().toISOString(),
    dryRun: cfg.dryRun,
    selectedProfiles,
    postLimit: cfg.postLimit,
    outlierMultiplier: cfg.outlierMultiplier,
    targetMin: cfg.targetMin,
    targetMax: cfg.targetMax,
    scrapedPosts: 0,
    candidateOutliers: 0,
    newFrameworks: 0,
    discoveredInfluencerTouches: 0,
    errors: [],
  }

  const newEntries = []
  if (selectedProfiles.length > 0 && !cfg.dryRun) {
    const client = new ApifyClient({ token: cfg.apifyToken })
    const grouped = await scrapeProfiles(client, selectedProfiles, cfg)
    for (const profile of selectedProfiles) {
      const rawItems = grouped.get(profile.slug) || []
      runSummary.scrapedPosts += rawItems.length
      runSummary.discoveredInfluencerTouches += discoverInfluencersFromItems(rawItems, discoveryState, profile.slug)
      discoveryState.knownInfluencers[profile.slug] = {
        ...(discoveryState.knownInfluencers[profile.slug] || {}),
        name: profile.name,
        slug: profile.slug,
        source: profile.source,
        lastScrapedAt: runSummary.ranAt,
      }

      const posts = rawItems.map((item) => normalizePost(item, profile.slug, profile.name)).filter((p) => p.urn && p.text.trim())
      const outliers = findOutliers(posts, cfg)
      runSummary.candidateOutliers += outliers.length

      for (const post of outliers) {
        if (newEntries.length >= cfg.targetMax) break
        if (existingUrns.has(post.urn)) continue
        try {
          console.log(`Extracting framework ${newEntries.length + 1}/${cfg.targetMax}: ${profile.slug} ${post.urn}`)
          const extracted = await extractFramework(post, cfg)
          const entry = makeCatalogEntry(post, extracted)
          if (entry.hasFramework) {
            newEntries.push(entry)
            existingUrns.add(post.urn)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          runSummary.errors.push(`${profile.slug}:${post.urn}:${msg}`)
          console.warn(`Framework extraction failed: ${msg}`)
          if (runSummary.errors.length >= 3) break
        }
      }
    }
  }

  runSummary.newFrameworks = newEntries.length
  discoveryState.updatedAt = runSummary.ranAt
  discoveryState.runs = [runSummary, ...(Array.isArray(discoveryState.runs) ? discoveryState.runs : [])].slice(0, 30)

  const nextCatalog = mergeCatalog(catalog, newEntries, runSummary)
  if (!cfg.dryRun && !cfg.noUpload && supabase) {
    await uploadJsonObject(supabase, cfg.bucket, cfg.catalogPath, nextCatalog)
    await uploadJsonObject(supabase, cfg.bucket, cfg.discoveryPath, discoveryState)
    console.log(`Uploaded catalog to ${cfg.bucket}/${cfg.catalogPath}`)
    console.log(`Uploaded discovery state to ${cfg.bucket}/${cfg.discoveryPath}`)
  } else {
    console.log('Dry run/no upload: remote catalog was not changed.')
  }

  console.log(
    JSON.stringify(
      {
        selectedProfiles: selectedProfiles.length,
        scrapedPosts: runSummary.scrapedPosts,
        candidateOutliers: runSummary.candidateOutliers,
        newFrameworks: runSummary.newFrameworks,
        catalogEntries: nextCatalog.count,
        errors: runSummary.errors.length,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
