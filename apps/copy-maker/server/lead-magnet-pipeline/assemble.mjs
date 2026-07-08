import fs from 'node:fs'
import path from 'node:path'

function embedAsset(paths, visualId) {
  const fp = path.join(paths.assetsDir, `${visualId}.svg`)
  if (!fs.existsSync(fp)) return ''
  const svg = fs.readFileSync(fp, 'utf8')
  return `<div class="visual">${svg}</div>`
}

export function stageAssembleHtml({ source, plan, content, paths }) {
  const lesson = content.lessons?.[0]
  const paragraphs = Array.isArray(lesson?.slots?.['body-paragraphs']) ? lesson.slots['body-paragraphs'] : []
  const visual = plan.visuals?.[0]?.id ? embedAsset(paths, plan.visuals[0].id) : ''
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${source.global.guide_title_hint}</title>
  <style>
    body { margin: 0; padding: 0; font-family: Montserrat, sans-serif; color: #0f172a; background: #ffffff; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm; box-sizing: border-box; }
    .tag { display:inline-block; border-radius: 999px; background: #d1fae5; color: #047857; font-size: 12px; padding: 6px 10px; font-weight: 700; }
    h1 { font-size: 40px; margin: 12px 0; line-height: 1.05; }
    h2 { font-size: 28px; margin: 0 0 10px; }
    .muted { color: #475569; }
    .rule { width: 100%; height: 3px; background: #059669; margin: 18px 0; }
    p { font-size: 18px; line-height: 1.55; margin: 10px 0; }
    .block-dark { margin-top: 18px; padding: 16px; border-radius: 10px; background: #030a17; color: #fff; }
    .tasks { margin-top: 16px; }
    .task { padding: 10px 12px; border: 1px solid rgba(15,23,42,0.12); border-radius: 8px; margin-bottom: 8px; }
    .visual { margin: 14px 0; border: 2px dashed #059669; border-radius: 10px; overflow: hidden; }
    .footer { margin-top: 20px; font-size: 13px; color: #334155; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <section class="page">
    <span class="tag">${content.cover.tag_text}</span>
    <h1>${content.cover.h1_line_1}<br/>${content.cover.h1_line_2}</h1>
    <p class="muted">${content.cover.subtitle}</p>
    <div class="rule"></div>

    <h2>${lesson?.slots?.['lesson-title'] || plan.lessons?.[0]?.title || 'Lesson'}</h2>
    ${paragraphs.map((p) => `<p>${String(p.text || '')}</p>`).join('\n')}
    ${visual}
    <div class="block-dark">
      <strong>${lesson?.slots?.['block-dark-challenge']?.label || 'Challenge'}</strong>
      <p>${lesson?.slots?.['block-dark-challenge']?.title || ''}</p>
      <p>${lesson?.slots?.['block-dark-challenge']?.body || ''}</p>
    </div>

    <div class="tasks">
      <h2>${content.tasks_page.heading_line_1}</h2>
      <p class="muted">${content.tasks_page.heading_line_2}</p>
      ${Array.isArray(content.tasks_page.tasks)
        ? content.tasks_page.tasks
            .map(
              (t) => `<div class="task"><strong>${t.number} ${t.title}</strong><p>${t.description || ''}</p></div>`,
            )
            .join('\n')
        : ''}
    </div>

    <div class="footer"><span>${content.tasks_page.footer_left || 'Vantum'}</span><span>${content.tasks_page.footer_right || source.global.guide_slug}</span></div>
  </section>
</body>
</html>`
  return html
}
