import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(THIS_DIR, '../..')
const REPO_ROOT = path.resolve(APP_ROOT, '../..')
const DEFAULT_ACTOR_ID = 'M2FMdjRVeF1HPGFcc'

let envLoaded = false
let supabaseClient = null

function loadEnvFile(fp) {
  if (!fs.existsSync(fp)) return
  const text = fs.readFileSync(fp, 'utf8')
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] != null) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

function maybeLoadEnv() {
  if (envLoaded) return
  envLoaded = true
  loadEnvFile(path.join(REPO_ROOT, '.env'))
  loadEnvFile(path.join(REPO_ROOT, '.env.local'))
  loadEnvFile(path.join(APP_ROOT, '.env'))
  loadEnvFile(path.join(APP_ROOT, '.env.local'))
}

function getEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key]
    if (value) return value
  }
  return ''
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient
  maybeLoadEnv()
  const url = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE', 'VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    throw new Error('Missing Supabase env vars (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)')
  }
  supabaseClient = createClient(url, key, { auth: { persistSession: false } })
  return supabaseClient
}

function normalizeLinkedinUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const parsed = new URL(raw)
    parsed.hash = ''
    parsed.search = ''
    parsed.protocol = 'https:'
    parsed.hostname = parsed.hostname.replace(/^www\./i, '').toLowerCase()
    return parsed.toString().replace(/\/+$/, '/')
  } catch {
    return raw
  }
}

function slugFromUrl(url) {
  const value = normalizeLinkedinUrl(url)
  const match = value.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : ''
}

function parseYear(value) {
  if (!value) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const m = value.match(/\b(19|20)\d{2}\b/)
    return m ? Number(m[0]) : null
  }
  if (typeof value === 'object') {
    if (Number.isFinite(value.year)) return Number(value.year)
    if (typeof value.date === 'string') return parseYear(value.date)
  }
  return null
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function deriveSignals(record) {
  const experience = toArray(record.experience)
  const education = toArray(record.education)
  const nowYear = new Date().getUTCFullYear()

  const expRows = experience.map((row) => {
    const startYear = parseYear(row?.startDate) ?? parseYear(row?.dateRange?.start)
    const endYear = parseYear(row?.endDate) ?? parseYear(row?.dateRange?.end)
    const endText = String(row?.endDate || row?.dateRange?.end || '').toLowerCase()
    const isActive = !endYear && (endText.includes('present') || !row?.endDate)
    return {
      startYear,
      endYear,
      isActive,
      position: row?.title || row?.position || null,
      company: row?.companyName || row?.company || null,
      duration: row?.duration || null,
      employmentType: row?.employmentType || null,
    }
  })

  const earliestJobYear = expRows.map((r) => r.startYear).filter(Boolean).sort((a, b) => a - b)[0] ?? null
  const earliestEduYear =
    education
      .map((e) => parseYear(e?.startDate) ?? parseYear(e?.dateRange?.start) ?? parseYear(e?.endDate))
      .filter(Boolean)
      .sort((a, b) => a - b)[0] ?? null
  const registeredYear = parseYear(record.registeredAt)

  const activeRoles = expRows
    .filter((r) => r.isActive)
    .map((r) => ({
      position: r.position,
      company: r.company,
      duration: r.duration,
      employment_type: r.employmentType,
    }))

  const fractionalRoles = expRows.filter((r) =>
    /fractional|self-employed|consult/i.test(`${r.position || ''} ${r.company || ''}`),
  )
  const fractionalStartYear = fractionalRoles
    .map((r) => r.startYear)
    .filter(Boolean)
    .sort((a, b) => a - b)[0] ?? null

  const estimatedFromBachelor = education
    .filter((e) => /bachelor/i.test(`${e?.degreeName || e?.degree || ''}`))
    .map((e) => parseYear(e?.startDate) ?? parseYear(e?.dateRange?.start))
    .filter(Boolean)
    .sort((a, b) => a - b)[0] ?? null

  let estimatedAge = null
  let estimatedAgeMethod = 'none'
  let estimatedAgeConfidence = 'none'
  if (estimatedFromBachelor) {
    estimatedAge = nowYear - estimatedFromBachelor + 18
    estimatedAgeMethod = 'bachelor'
    estimatedAgeConfidence = 'high'
  } else if (earliestEduYear) {
    estimatedAge = nowYear - earliestEduYear + 18
    estimatedAgeMethod = 'earliest_edu'
    estimatedAgeConfidence = 'medium'
  } else if (earliestJobYear) {
    estimatedAge = nowYear - earliestJobYear + 22
    estimatedAgeMethod = 'first_job'
    estimatedAgeConfidence = 'low'
  }

  return {
    estimated_age: estimatedAge,
    estimated_age_method: estimatedAgeMethod,
    estimated_age_confidence: estimatedAgeConfidence,
    career_years: earliestJobYear ? nowYear - earliestJobYear : null,
    linkedin_tenure_years: registeredYear ? nowYear - registeredYear : null,
    years_since_fractional: fractionalStartYear ? nowYear - fractionalStartYear : null,
    fractional_start_year: fractionalStartYear,
    active_roles_count: activeRoles.length,
    active_roles: activeRoles,
    has_fractional_in_title: /fractional/i.test(String(record.headline || '')),
    is_fractional_coo: /fractional/i.test(String(record.headline || '')) && /coo|chief operating/i.test(String(record.headline || '')),
    appears_to_have_team: Boolean(record.hiring),
    current_employment_type: expRows.find((r) => r.isActive)?.employmentType || null,
  }
}

function mapLinkedinRecordToPeoplePayload(record, fallbackName, personaStage, scrapeCount, isNew) {
  const firstName = String(record.firstName || '').trim()
  const lastName = String(record.lastName || '').trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || fallbackName || null
  const location = record.location?.parsed || {}
  const nowIso = new Date().toISOString()
  const signals = deriveSignals(record)

  const payload = {
    name: fullName,
    persona_stage: personaStage || null,
    linkedin_urn: record.id || null,
    linkedin_slug: String(record.publicIdentifier || '').trim() || slugFromUrl(record.linkedinUrl) || null,
    linkedin_object_urn: record.objectUrn || null,
    about_text: record.about || null,
    linkedin_registered_at: record.registeredAt || null,
    follower_count: Number.isFinite(Number(record.followerCount)) ? Number(record.followerCount) : null,
    is_premium: Boolean(record.premium),
    is_verified: Boolean(record.verified),
    is_creator: Boolean(record.creator),
    is_influencer: Boolean(record.influencer),
    is_hiring: Boolean(record.hiring),
    is_open_to_work: Boolean(record.openToWork),
    open_profile: Boolean(record.openProfile),
    compose_option_type: record.composeOptionType || null,
    country_code: location.countryCode || null,
    country: location.country || null,
    state: location.state || null,
    city: location.city || null,
    us_based: String(location.countryCode || '').toUpperCase() === 'US',
    ...signals,
    experience: toArray(record.experience),
    education: toArray(record.education),
    skills: toArray(record.skills),
    skills_count: toArray(record.skills).length,
    certifications: toArray(record.certifications),
    certifications_count: toArray(record.certifications).length,
    services: toArray(record.servicesList || record.services),
    recommendations: toArray(record.recommendations),
    recommendations_count: toArray(record.recommendations).length,
    volunteering: toArray(record.volunteering),
    causes: toArray(record.causes),
    publications: toArray(record.publications),
    honors_awards: toArray(record.honorsAndAwards || record.honors_awards),
    languages: toArray(record.languages),
    latest_raw_json: record,
    last_scraped_at: nowIso,
    scrape_count: scrapeCount,
  }

  if (isNew) {
    payload.stage = 'new'
    payload.first_scraped_at = nowIso
  }
  return payload
}

async function runApifyActor(body) {
  maybeLoadEnv()
  const token = getEnv('APIFY_TOKEN', 'APIFY_API_TOKEN')
  if (!token) throw new Error('Missing APIFY_TOKEN')
  const actorId = getEnv('APIFY_LINKEDIN_ACTOR_ID') || DEFAULT_ACTOR_ID
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=1800`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Apify actor failed (${res.status}): ${text || 'unknown error'}`)
  }
  const data = await res.json()
  if (!Array.isArray(data)) throw new Error('Apify response was not an array')
  return data
}

function splitName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function firstToken(name) {
  return normalizeName(name).split(/\s+/).filter(Boolean)[0] || ''
}

const FIRST_NAME_EQUIVALENTS = new Map([
  ['zach', new Set(['zachary'])],
  ['zachary', new Set(['zach'])],
  ['philip', new Set(['phillip'])],
  ['phillip', new Set(['philip'])],
  ['katy', new Set(['kathryn'])],
  ['kathryn', new Set(['katy'])],
  ['jithesh', new Set(['jitesh'])],
  ['jitesh', new Set(['jithesh'])],
  ['tory', new Set(['tori'])],
  ['tori', new Set(['tory'])],
  ['murugappan', new Set(['marugapod'])],
  ['marugapod', new Set(['murugappan'])],
])

function firstNameEquivalent(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  return FIRST_NAME_EQUIVALENTS.get(a)?.has(b) || FIRST_NAME_EQUIVALENTS.get(b)?.has(a) || false
}

async function scrapeSingleProfile(profile) {
  const normalizedUrl = normalizeLinkedinUrl(profile.linkedinUrl)
  const slug = slugFromUrl(normalizedUrl)
  const fallbackName = String(profile.fallbackName || '').trim()
  const { firstName, lastName } = splitName(fallbackName)

  // Attempt direct-url input variants first for actors that support URL scraping.
  const directPayloads = [
    { profileUrls: [normalizedUrl] },
    { linkedinUrls: [normalizedUrl] },
    { startUrls: [{ url: normalizedUrl }] },
  ]
  for (const payload of directPayloads) {
    const rows = await runApifyActor(payload).catch(() => [])
    const exact = rows.find((row) => normalizeLinkedinUrl(row.linkedinUrl) === normalizedUrl)
    if (exact) return exact
  }

  // Fallback for search-based actors: search by name and then match URL/slug from results.
  const searchPayload = {
    profileScraperMode: 'Full',
    searchQuery: fallbackName || slug.replace(/-/g, ' '),
    firstNames: firstName ? [firstName] : undefined,
    lastNames: lastName ? [lastName] : undefined,
    takePages: 2,
    maxItems: 100,
  }
  const rows = await runApifyActor(searchPayload)
  const byUrl = rows.find((row) => normalizeLinkedinUrl(row.linkedinUrl) === normalizedUrl)
  if (byUrl) return byUrl
  const bySlug = rows.find((row) => String(row.publicIdentifier || '').toLowerCase() === slug)
  if (bySlug) return bySlug
  return null
}

async function findMatchingPerson(supabase, { linkedinUrn, linkedinSlug, fallbackName }) {
  if (linkedinUrn) {
    const byUrn = await supabase
      .from('people')
      .select('id, name, persona_stage, scrape_count')
      .eq('linkedin_urn', linkedinUrn)
      .maybeSingle()
    if (byUrn.data) return byUrn.data
  }
  if (linkedinSlug) {
    const bySlug = await supabase
      .from('people')
      .select('id, name, persona_stage, scrape_count')
      .eq('linkedin_slug', linkedinSlug)
      .maybeSingle()
    if (bySlug.data) return bySlug.data
  }
  if (fallbackName) {
    const byName = await supabase
      .from('people')
      .select('id, name, persona_stage, scrape_count')
      .ilike('name', fallbackName)
      .limit(1)
    if (byName.data?.[0]) return byName.data[0]

    // Heuristic pass to avoid creating duplicates when interview records
    // store short names (e.g. "ZACH") and scraped records use full names.
    const candidatesRes = await supabase
      .from('people')
      .select('id, name, persona_stage, scrape_count, stage, linkedin_slug')
      .order('id', { ascending: true })
    const candidates = candidatesRes.data || []

    const targetFirst = firstToken(fallbackName)
    const targetNorm = normalizeName(fallbackName)
    const targetTokens = targetNorm.split(/\s+/).filter(Boolean)
    const targetLast = targetTokens[targetTokens.length - 1] || ''
    let best = null
    let bestScore = -1
    let tie = false

    for (const cand of candidates) {
      const candName = String(cand.name || '')
      const candNorm = normalizeName(candName)
      const candFirst = firstToken(candName)
      const candTokens = candNorm.split(/\s+/).filter(Boolean)
      const candLast = candTokens[candTokens.length - 1] || ''

      let score = 0
      if (candNorm && targetNorm && candNorm === targetNorm) score += 120
      if (firstNameEquivalent(targetFirst, candFirst)) score += 70
      if (targetLast && candLast && targetLast === candLast) score += 90
      if (candNorm.includes('problemtranscript') || candNorm.includes('problem')) score -= 40
      if (candNorm.includes('transcript')) score -= 20
      if (cand.stage === 'problem_interview') score += 20
      if (cand.linkedin_slug && linkedinSlug && String(cand.linkedin_slug).toLowerCase() !== String(linkedinSlug).toLowerCase()) {
        score -= 60
      }

      if (score > bestScore) {
        best = cand
        bestScore = score
        tie = false
      } else if (score === bestScore) {
        tie = true
      }
    }

    // Only auto-match when we have a clear, strong winner.
    if (best && !tie && bestScore >= 90) return best
  }
  return null
}

async function saveStagingRow(supabase, row) {
  const { error } = await supabase.from('linkedin_scrapes').insert([row])
  if (error && !/relation .*linkedin_scrapes.* does not exist/i.test(error.message)) {
    throw new Error(`linkedin_scrapes insert failed: ${error.message}`)
  }
}

export async function enrichSingleLinkedInProfile({ linkedinUrl, fallbackName, personaStage, source }) {
  const [result] = await enrichLinkedinProfiles({
    profiles: [{ linkedinUrl, fallbackName, personaStage, source }],
  })
  return result
}

export async function enrichLinkedinProfiles({ profiles }) {
  const supabase = getSupabaseClient()
  if (!profiles.length) return []
  const out = []

  for (const profile of profiles) {
    const normalizedUrl = normalizeLinkedinUrl(profile.linkedinUrl)
    const slug = slugFromUrl(normalizedUrl)
    const scraped = await scrapeSingleProfile(profile)
    if (!scraped) {
      out.push({ linkedinUrl: normalizedUrl, status: 'not_found' })
      continue
    }

    const match = await findMatchingPerson(supabase, {
      linkedinUrn: scraped.id || null,
      linkedinSlug: String(scraped.publicIdentifier || '').toLowerCase() || slug,
      fallbackName: profile.fallbackName || [scraped.firstName, scraped.lastName].filter(Boolean).join(' ') || null,
    })

    const nextCount = Number(match?.scrape_count || 0) + 1
    const payload = mapLinkedinRecordToPeoplePayload(
      scraped,
      profile.fallbackName,
      profile.personaStage || match?.persona_stage || null,
      nextCount,
      !match,
    )

    let personId = match?.id || null
    if (match) {
      const { data, error } = await supabase.from('people').update(payload).eq('id', match.id).select('id').single()
      if (error) throw new Error(`people update failed: ${error.message}`)
      personId = data.id
    } else {
      const { data, error } = await supabase.from('people').insert([payload]).select('id').single()
      if (error) throw new Error(`people insert failed: ${error.message}`)
      personId = data.id
    }

    await saveStagingRow(supabase, {
      person_id: personId,
      linkedin_urn: scraped.id || `slug:${slug || 'unknown'}`,
      linkedin_slug: payload.linkedin_slug,
      apify_run_id: null,
      raw_json: scraped,
      scraped_at: new Date().toISOString(),
    })

    out.push({
      linkedinUrl: normalizedUrl,
      status: match ? 'updated' : 'inserted',
      personId,
      matchedBy: match?.linkedin_urn ? 'linkedin_urn' : match?.name ? 'name_or_slug' : 'new',
    })
  }

  return out
}
