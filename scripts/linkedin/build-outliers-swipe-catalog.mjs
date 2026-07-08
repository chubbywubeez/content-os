/**
 * Compile all `data/outliers_by_person/*_cleaned.md` swipe files into one JSON catalog
 * for Content OS (`/api/outliers-catalog`).
 *
 * Usage (repo root):
 *   node scripts/linkedin/build-outliers-swipe-catalog.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCleanedSwipeFile } from './parse-cleaned-swipe.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const PERSON_DIR = path.join(ROOT, 'data', 'outliers', 'data', 'outliers_by_person')
const OUT_JSON = path.join(ROOT, 'data', 'outliers', 'data', 'outliers_swipe_catalog.json')
const OUTLIERS_INDEX = path.join(ROOT, 'data', 'outliers', 'data', 'outliers_index.json')

/** @returns {Map<string, number>} */
function loadMaxRatioByUrn() {
  const map = new Map()
  if (!fs.existsSync(OUTLIERS_INDEX)) return map
  try {
    const index = JSON.parse(fs.readFileSync(OUTLIERS_INDEX, 'utf8'))
    for (const block of index.bySlug ?? []) {
      for (const rec of block.outliers ?? []) {
        const urn = String(rec.urn || '')
        if (!urn) continue
        const maxRatio = typeof rec.maxRatio === 'number' ? rec.maxRatio : 0
        map.set(urn, maxRatio)
      }
    }
  } catch {
    /* ignore */
  }
  return map
}

function main() {
  if (!fs.existsSync(PERSON_DIR)) {
    console.error('Missing directory:', PERSON_DIR)
    process.exit(1)
  }

  const files = fs
    .readdirSync(PERSON_DIR)
    .filter((f) => f.endsWith('_cleaned.md'))
    .sort()

  if (files.length === 0) {
    console.warn('No *_cleaned.md files in', PERSON_DIR)
    console.warn('Run: node scripts/linkedin/clean-person-outliers.mjs <slug> ...')
  }

  const maxRatioByUrn = loadMaxRatioByUrn()
  /** @type {import('./parse-cleaned-swipe.mjs').SwipeCatalogEntry[]} */
  const entries = []
  const byCreator = []
  const urnSeen = new Map()

  for (const file of files) {
    const fp = path.join(PERSON_DIR, file)
    const { creator, slug, entries: parsed } = parseCleanedSwipeFile(fp)
    byCreator.push({ slug, creator, file, count: parsed.length })
    for (const e of parsed) {
      const prev = urnSeen.get(e.urn)
      if (prev) {
        console.warn(`Duplicate URN ${e.urn}: keeping ${prev}, skipping ${file}`)
        continue
      }
      urnSeen.set(e.urn, file)
      const maxRatio = maxRatioByUrn.get(e.urn) ?? 0
      entries.push({ ...e, maxRatio })
    }
  }

  entries.sort((a, b) => b.maxRatio - a.maxRatio || b.likes - a.likes)

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'outliers_by_person/*_cleaned.md',
    sourceFiles: files,
    creators: byCreator,
    count: entries.length,
    entries,
  }

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log('Wrote', OUT_JSON)
  console.log('Creators:', byCreator.map((c) => `${c.slug} (${c.count})`).join(', ') || '(none)')
  console.log('Entries:', entries.length)
}

main()
