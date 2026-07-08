import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(THIS_DIR, '../../../..')
export const LEAD_MAGNETS_ROOT = path.join(REPO_ROOT, 'data', 'generated', 'lead-magnets')

function safeSlug(input) {
  const slug = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || `lead-magnet-${Date.now()}`
}

export function leadMagnetPaths(slugInput) {
  const slug = safeSlug(slugInput)
  const rootDir = path.join(LEAD_MAGNETS_ROOT, slug)
  const assetsDir = path.join(rootDir, 'assets')
  const cacheDir = path.join(rootDir, 'cache')
  return {
    slug,
    rootDir,
    assetsDir,
    cacheDir,
    sourceJson: path.join(rootDir, 'source.json'),
    planJson: path.join(rootDir, 'plan.json'),
    contentDraftJson: path.join(rootDir, 'content.draft.json'),
    contentVoicedJson: path.join(rootDir, 'content.voiced.json'),
    contentFinalJson: path.join(rootDir, 'content.final.json'),
    auditJson: path.join(rootDir, 'audit-report.json'),
    stagingHtml: path.join(cacheDir, 'staging.html'),
    stagingPdf: path.join(cacheDir, 'staging.pdf'),
    guideHtml: path.join(rootDir, 'guide.html'),
    guidePdf: path.join(rootDir, 'guide.pdf'),
    metaJson: path.join(rootDir, 'meta.json'),
  }
}

export function ensureLeadMagnetDirs(paths) {
  for (const d of [LEAD_MAGNETS_ROOT, paths.rootDir, paths.assetsDir, paths.cacheDir]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

export function listLeadMagnetSlugs() {
  if (!fs.existsSync(LEAD_MAGNETS_ROOT)) return []
  const out = []
  for (const name of fs.readdirSync(LEAD_MAGNETS_ROOT)) {
    const fp = path.join(LEAD_MAGNETS_ROOT, name)
    if (!fs.statSync(fp).isDirectory()) continue
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}
