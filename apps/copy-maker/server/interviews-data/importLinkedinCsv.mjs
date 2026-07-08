import fs from 'node:fs'
import path from 'node:path'
import { enrichLinkedinProfiles } from './linkedinEnrichment.mjs'

function parseCsvLine(line) {
  const out = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    const next = line[i + 1]
    if (ch === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  out.push(current.trim())
  return out
}

function parseLinkedinCsv(csvText) {
  const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase())
  const idxFirst = headers.findIndex((h) => h.includes('first'))
  const idxLast = headers.findIndex((h) => h.includes('last'))
  const idxLinkedin = headers.findIndex((h) => h.includes('linkedin'))
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const first = cols[idxFirst] || ''
    const last = cols[idxLast] || ''
    const linkedinUrl = cols[idxLinkedin] || ''
    return {
      fallbackName: [first, last].filter(Boolean).join(' ').trim(),
      linkedinUrl,
      personaStage: null,
      source: 'csv_import',
    }
  }).filter((row) => row.linkedinUrl)
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    throw new Error('Usage: node server/interviews-data/importLinkedinCsv.mjs "<path-to-csv>"')
  }
  const absPath = path.resolve(process.cwd(), csvPath)
  if (!fs.existsSync(absPath)) throw new Error(`CSV file not found: ${absPath}`)

  const csvText = fs.readFileSync(absPath, 'utf8')
  const profiles = parseLinkedinCsv(csvText)
  if (!profiles.length) {
    console.log('No LinkedIn URLs found in CSV.')
    return
  }

  console.log(`Scraping ${profiles.length} LinkedIn profile(s) via Apify...`)
  const results = await enrichLinkedinProfiles({ profiles })
  const summary = results.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1
      return acc
    },
    /** @type {Record<string, number>} */ ({}),
  )

  console.log('Import finished.')
  console.log(JSON.stringify({ total: results.length, summary }, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
