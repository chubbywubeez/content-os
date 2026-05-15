/**
 * One-off / repeatable: strip HTML design system to plain text for `vantum_style_guide.md`.
 * Run from repo root: node copy-maker/scripts/gen-style-guide-md.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const HTML = path.join(ROOT, 'OS', 'Style Guide', 'vantum_pdf_design_system_v2.html')
const OUT = path.join(ROOT, 'OS', 'Style Guide', 'vantum_style_guide.md')

function htmlToPlainText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const html = fs.readFileSync(HTML, 'utf8')
const body = htmlToPlainText(html)
const head = `# Vantum design system (Content OS)

Plain-text export of \`vantum_pdf_design_system_v2.html\` for LLM prompts. Prefer editing this file for Content OS; the HTML file remains for visual layout reference.

---

`
fs.writeFileSync(OUT, head + body, 'utf8')
console.log('Wrote', OUT, '(' + fs.statSync(OUT).size + ' bytes)')
