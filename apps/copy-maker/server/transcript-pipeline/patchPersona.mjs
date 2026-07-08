import fs from 'node:fs'
import path from 'node:path'
import { PERSONAS_DIR, PERSONA_FILES } from './paths.mjs'

const IN_THEIR_WORDS = /^## In their words\s*$/im

/**
 * Append new blockquotes under ## In their words (skip duplicates).
 * @param {{ persona: 'tofu'|'mofu'|'bofu', snippets: { pull_quote: string }[], sourceLabel: string }} input
 */
export function appendQuotesToPersona(input) {
  const file = PERSONA_FILES[input.persona]
  if (!file) throw new Error(`Unknown persona: ${input.persona}`)
  const fp = path.join(PERSONAS_DIR, file)
  if (!fs.existsSync(fp)) throw new Error(`Persona file missing: ${fp}`)

  let md = fs.readFileSync(fp, 'utf8')
  const sectionMatch = md.match(IN_THEIR_WORDS)
  if (!sectionMatch || sectionMatch.index == null) {
    throw new Error(`Persona file has no "## In their words" section: ${file}`)
  }

  const insertAt = sectionMatch.index + sectionMatch[0].length
  const before = md.slice(0, insertAt)
  const after = md.slice(insertAt)

  const existingLower = md.toLowerCase()
  const toAdd = []
  for (const s of input.snippets) {
    const q = String(s.pull_quote || '').trim()
    if (!q || q.length < 12) continue
    if (existingLower.includes(q.toLowerCase().slice(0, 40))) continue
    toAdd.push(`> "${q.replace(/"/g, "'")}"`)
    toAdd.push('')
    toAdd.push(`> *Source: ${input.sourceLabel}*`)
    toAdd.push('')
  }

  if (toAdd.length === 0) {
    return { file, added: 0, skipped: input.snippets.length }
  }

  const block = '\n' + toAdd.join('\n')
  md = before + block + after
  fs.writeFileSync(fp, md, 'utf8')
  return { file, added: toAdd.filter((l) => l.startsWith('> "')).length, skipped: 0 }
}
