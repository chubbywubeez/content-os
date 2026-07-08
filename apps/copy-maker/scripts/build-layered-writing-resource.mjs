import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(THIS_DIR, '..')
const OUT_DIR = path.join(APP_ROOT, 'public', 'resources')
const SRC = process.argv[2] || path.join(APP_ROOT, 'public', 'resources', 'layered_writing_system.md')
const slug = 'layered_writing_system'
const title = 'The Layered Writing System'

const md = fs.readFileSync(SRC, 'utf8')

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function mdToHtml(mdText) {
  const lines = mdText.split(/\r?\n/)
  let html = ''
  let inList = false
  const closeList = () => {
    if (inList) {
      html += '</ul>\n'
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.startsWith('# ')) {
      closeList()
      html += `<h1>${inline(line.slice(2))}</h1>\n`
      continue
    }
    if (line.startsWith('## ')) {
      closeList()
      html += `<h2>${inline(line.slice(3))}</h2>\n`
      continue
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        html += '<ul>\n'
        inList = true
      }
      html += `<li>${inline(line.slice(2))}</li>\n`
      continue
    }
    if (line.trim() === '---') {
      closeList()
      html += '<hr>\n'
      continue
    }
    if (line.trim() === '') {
      closeList()
      continue
    }
    closeList()
    html += `<p>${inline(line)}</p>\n`
  }
  closeList()
  return html
}

const body = mdToHtml(md)
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');
  body { font-family: Montserrat, sans-serif; background: #f7f8fa; color: #0f172a; line-height: 1.75; margin: 0; padding: 40px 20px; }
  .doc { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 48px 56px; box-shadow: 0 1px 3px rgba(15,23,42,0.06); }
  h1 { font-size: 28px; margin: 0 0 20px; color: #C97B00; }
  h2 { font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; margin: 32px 0 12px; color: #0f172a; }
  p { margin: 0 0 14px; color: #475569; font-size: 14px; }
  ul { margin: 0 0 16px 20px; color: #475569; font-size: 14px; }
  li { margin-bottom: 8px; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
  strong { color: #0f172a; }
</style>
</head>
<body>
<article class="doc">${body}</article>
<script>
const markdownContent = ${JSON.stringify(md)};
</script>
</body>
</html>`

fs.mkdirSync(OUT_DIR, { recursive: true })
fs.writeFileSync(path.join(OUT_DIR, `${slug}.md`), `${md.trimEnd()}\n`, 'utf8')
fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), html, 'utf8')
fs.writeFileSync(
  path.join(OUT_DIR, `${slug}.json`),
  `${JSON.stringify(
    {
      slug,
      title,
      sourceHtml: `${slug}.html`,
      updatedAt: new Date().toISOString(),
      markdown: `${md.trimEnd()}\n`,
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`generated ${slug}.md, ${slug}.html, ${slug}.json`)
