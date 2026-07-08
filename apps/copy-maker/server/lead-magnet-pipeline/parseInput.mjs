import { parseKeyValueFrontmatter } from './utils.mjs'

export function stageParseInput({ briefMarkdown, slug }) {
  const parsed = parseKeyValueFrontmatter(briefMarkdown)
  const titleHint = parsed.meta.guide_title_hint || parsed.meta.title || `Lead Magnet ${slug}`
  const source = {
    global: {
      guide_slug: slug,
      guide_title_hint: String(titleHint),
      course_title: String(parsed.meta.course_title || titleHint),
      register: String(parsed.meta.register || 'newsletter'),
    },
    lessons: [
      {
        lesson_id: '1.1',
        subject: String(parsed.meta.subject || 'Core lesson'),
        length: String(parsed.meta.length || 'medium'),
        register: String(parsed.meta.register || 'newsletter'),
        brief: String(parsed.meta.brief || 'Primary lesson from uploaded brief'),
        key_points: String(parsed.body || '')
          .split(/\r?\n/)
          .map((line) => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
          .slice(0, 8),
        brief_text: String(parsed.body || '').trim(),
      },
    ],
  }
  return source
}
