import fs from 'node:fs'
import { stageAssembleHtml } from './assemble.mjs'
import { stageRenderPdf } from './stageRender.mjs'

export function stageFinalRender({ source, plan, contentFinal, paths, auditReport }) {
  const html = stageAssembleHtml({ source, plan, content: contentFinal, paths })
  fs.writeFileSync(paths.guideHtml, html, 'utf8')
  stageRenderPdf(html, paths.guidePdf)
  return {
    guideHtml: paths.guideHtml,
    guidePdf: paths.guidePdf,
    auditSummary: auditReport?.summary ?? null,
  }
}
