import fs from 'node:fs'
import path from 'node:path'

export function writeJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`
  fs.writeFileSync(filePath, text, 'utf8')
}

export function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

export function nowIso() {
  return new Date().toISOString()
}

export function parseKeyValueFrontmatter(markdown) {
  const text = String(markdown || '')
  if (!text.trimStart().startsWith('---')) return { meta: {}, body: text.trim() }
  const first = text.indexOf('\n')
  const end = text.indexOf('\n---', first + 1)
  if (end < 0) return { meta: {}, body: text.trim() }
  const fm = text.slice(first + 1, end).trim()
  const body = text.slice(end + 4).trim()
  const meta = {}
  for (const row of fm.split(/\r?\n/)) {
    const idx = row.indexOf(':')
    if (idx < 1) continue
    const key = row.slice(0, idx).trim()
    const val = row.slice(idx + 1).trim()
    if (!key) continue
    meta[key] = val
  }
  return { meta, body }
}

export function escapePdfText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Deterministic tiny single-page PDF for pipeline output previews.
 */
export function writeSimplePdf(filePath, lines) {
  const safeLines = Array.isArray(lines) ? lines : [String(lines || '')]
  const content = safeLines
    .map((line, idx) => {
      const y = 800 - idx * 16
      return `BT /F1 11 Tf 40 ${Math.max(y, 40)} Td (${escapePdfText(line)}) Tj ET`
    })
    .join('\n')

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}\nendstream endobj`,
  ]

  const chunks = ['%PDF-1.4\n']
  const xref = [0]
  for (const obj of objects) {
    xref.push(Buffer.byteLength(chunks.join(''), 'utf8'))
    chunks.push(`${obj}\n`)
  }
  const xrefPos = Buffer.byteLength(chunks.join(''), 'utf8')
  chunks.push(`xref\n0 ${objects.length + 1}\n`)
  chunks.push('0000000000 65535 f \n')
  for (let i = 1; i < xref.length; i++) {
    chunks.push(`${String(xref[i]).padStart(10, '0')} 00000 n \n`)
  }
  chunks.push(`trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`)
  fs.writeFileSync(filePath, chunks.join(''), 'utf8')
}

export function resolvePromptRoot(repoRoot) {
  return path.join(repoRoot, 'data', 'os', 'Style Guide', 'vantum_pdf_design_system_v2.md')
}
