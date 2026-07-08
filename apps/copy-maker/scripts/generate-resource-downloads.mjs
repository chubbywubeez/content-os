import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(THIS_DIR, '..')
const REPO_ROOT = path.resolve(APP_ROOT, '..', '..')
const RESOURCES_DIR = path.join(APP_ROOT, 'public', 'resources')

const RESOURCE_CONFIG = [
  {
    slug: 'vantum_voice_guide',
    title: 'Vantum Voice Guide',
    htmlFile: 'vantum_voice_guide.html',
    markdownSource: path.join(REPO_ROOT, 'data', 'os', 'Voices', 'vantum.md'),
  },
  {
    slug: 'vantum_pdf_design_system_v2',
    title: 'Vantum PDF Design System v2',
    htmlFile: 'vantum_pdf_design_system_v2.html',
    markdownSource: path.join(REPO_ROOT, 'data', 'os', 'Style Guide', 'vantum_style_guide.md'),
  },
  {
    slug: 'layered_writing_system',
    title: 'The Layered Writing System',
    htmlFile: 'layered_writing_system.html',
    markdownSource: path.join(RESOURCES_DIR, 'layered_writing_system.md'),
  },
  {
    slug: 'vantum-persona-bofu',
    title: 'Vantum Persona — BOFU',
    htmlFile: 'vantum-persona-bofu.html',
    markdownSource: path.join(REPO_ROOT, 'data', 'os', 'Customer Personas', 'vantum-persona-bofu.md'),
  },
  {
    slug: 'vantum-persona-mofu',
    title: 'Vantum Persona — MOFU',
    htmlFile: 'vantum-persona-mofu.html',
    markdownSource: path.join(REPO_ROOT, 'data', 'os', 'Customer Personas', 'vantum-persona-mofu.md'),
  },
  {
    slug: 'vantum-persona-tofu',
    title: 'Vantum Persona — TOFU',
    htmlFile: 'vantum-persona-tofu.html',
    markdownSource: path.join(REPO_ROOT, 'data', 'os', 'Customer Personas', 'vantum-persona-tofu.md'),
  },
]

function readIfExists(fp) {
  if (!fs.existsSync(fp)) return ''
  return fs.readFileSync(fp, 'utf8')
}

function stripHtmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|section|h1|h2|h3|h4|h5|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractEmbeddedMarkdown(html) {
  const match = html.match(/const\s+markdownContent\s*=\s*`([\s\S]*?)`;/)
  if (!match) return ''
  return match[1]
    .replace(/\\`/g, '`')
    .replace(/\\n/g, '\n')
    .trim()
}

for (const resource of RESOURCE_CONFIG) {
  const htmlPath = path.join(RESOURCES_DIR, resource.htmlFile)
  const html = readIfExists(htmlPath)
  if (!html) {
    console.warn(`skip: missing html file ${resource.htmlFile}`)
    continue
  }

  const markdownFromRepo = readIfExists(resource.markdownSource)
  const markdownFromHtml = extractEmbeddedMarkdown(html)
  const markdownFallback = `# ${resource.title}\n\n${stripHtmlToText(html)}\n`
  const markdown =
    (markdownFromRepo || markdownFromHtml || markdownFallback).trimEnd() +
    '\n\n---\n\nSource HTML: ' +
    resource.htmlFile +
    '\n'

  const jsonPayload = {
    slug: resource.slug,
    title: resource.title,
    sourceHtml: resource.htmlFile,
    updatedAt: new Date().toISOString(),
    markdown,
  }

  const mdPath = path.join(RESOURCES_DIR, `${resource.slug}.md`)
  const jsonPath = path.join(RESOURCES_DIR, `${resource.slug}.json`)
  fs.writeFileSync(mdPath, markdown, 'utf8')
  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, 'utf8')
  console.log(`generated: ${path.basename(mdPath)}, ${path.basename(jsonPath)}`)
}
