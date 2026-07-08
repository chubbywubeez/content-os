import fs from 'node:fs'
import path from 'node:path'
import { leadMagnetPaths, ensureLeadMagnetDirs, listLeadMagnetSlugs } from './paths.mjs'
import { nowIso, readJson, writeJson } from './utils.mjs'
import { stageParseInput } from './parseInput.mjs'
import { stagePlan } from './plan.mjs'
import { stageWrite } from './write.mjs'
import { stageVoiceAudit } from './voiceAudit.mjs'
import { stageVisualize } from './visualize.mjs'
import { stageAssembleHtml } from './assemble.mjs'
import { stageRenderPdf } from './stageRender.mjs'
import { stageMultiAudit } from './multiAudit.mjs'
import { stageAutoFix } from './autoFix.mjs'
import { stageFinalRender } from './finalRender.mjs'

const STAGE_META = {
  parse_input: 'Parse Input',
  plan: 'Plan',
  write: 'Write',
  voice_audit: 'Voice Audit',
  visualize: 'Visualize',
  assemble_html: 'Assemble HTML',
  stage_render: 'Stage Render',
  multi_audit: 'Multi Audit',
  auto_fix: 'Auto Fix',
  final_render: 'Final Render',
}

function event(step, status, message, detail = undefined) {
  return { step, status, title: STAGE_META[step] || step, message, detail }
}

export async function* runLeadMagnetPipeline({ slug, briefMarkdown }) {
  const paths = leadMagnetPaths(slug)
  ensureLeadMagnetDirs(paths)
  writeJson(paths.metaJson, { slug: paths.slug, startedAt: nowIso(), status: 'running' })

  try {
    yield event('parse_input', 'running', 'Parsing brief markdown...')
    const source = stageParseInput({ briefMarkdown, slug: paths.slug })
    writeJson(paths.sourceJson, source)
    yield event('parse_input', 'done', 'Parsed source brief.', { path: relPath(paths.sourceJson), lessons: source.lessons.length })

    yield event('plan', 'running', 'Building layout plan...')
    const plan = await stagePlan(source)
    writeJson(paths.planJson, plan)
    yield event('plan', 'done', 'Plan generated.', { path: relPath(paths.planJson), lessons: plan.lessons?.length ?? 0 })

    yield event('write', 'running', 'Writing lesson copy...')
    const contentDraft = await stageWrite(source, plan)
    writeJson(paths.contentDraftJson, contentDraft)
    yield event('write', 'done', 'Draft content generated.', { path: relPath(paths.contentDraftJson) })

    yield event('voice_audit', 'running', 'Applying voice rules...')
    const voiced = stageVoiceAudit(contentDraft)
    writeJson(paths.contentVoicedJson, voiced.content)
    writeJson(path.join(paths.rootDir, 'voice-audit.json'), { audit: voiced.audit, generatedAt: nowIso() })
    yield event('voice_audit', 'done', 'Voice audit complete.', { fixes: voiced.audit.length })

    yield event('visualize', 'running', 'Generating visuals...')
    const visuals = stageVisualize(plan, paths)
    yield event('visualize', 'done', 'Visual assets generated.', {
      count: visuals.length,
      assetsDir: relPath(paths.assetsDir),
    })

    yield event('assemble_html', 'running', 'Assembling staging HTML...')
    let contentCurrent = readJson(paths.contentVoicedJson, {})
    let html = stageAssembleHtml({ source, plan, content: contentCurrent, paths })
    fs.writeFileSync(paths.stagingHtml, html, 'utf8')
    yield event('assemble_html', 'done', 'Staging HTML generated.', { path: relPath(paths.stagingHtml) })

    yield event('stage_render', 'running', 'Rendering staging PDF...')
    stageRenderPdf(html, paths.stagingPdf)
    yield event('stage_render', 'done', 'Staging PDF generated.', { path: relPath(paths.stagingPdf) })

    yield event('multi_audit', 'running', 'Running audits...')
    let auditReport = {
      run_id: `${paths.slug}-${Date.now()}-iter-1`,
      ...stageMultiAudit({ plan, content: contentCurrent, html }),
    }
    writeJson(paths.auditJson, auditReport)
    yield event('multi_audit', 'done', 'Audit report generated.', { summary: auditReport.summary, path: relPath(paths.auditJson) })

    if ((auditReport.summary?.blockers ?? 0) > 0) {
      throw new Error('Audit blockers found. Fix input and rerun.')
    }

    let iterations = 0
    while ((auditReport.summary?.auto_fixes ?? 0) > 0 && iterations < 3) {
      iterations += 1
      yield event('auto_fix', 'running', `Applying auto-fixes (iteration ${iterations})...`)
      const fixed = stageAutoFix(contentCurrent, auditReport)
      contentCurrent = fixed.content
      writeJson(paths.contentFinalJson, contentCurrent)
      yield event('auto_fix', 'done', 'Auto-fix iteration complete.', { applied: fixed.fixes_applied.length })

      yield event('assemble_html', 'running', 'Reassembling HTML after auto-fix...')
      html = stageAssembleHtml({ source, plan, content: contentCurrent, paths })
      fs.writeFileSync(paths.stagingHtml, html, 'utf8')
      yield event('assemble_html', 'done', 'Reassembled staging HTML.', { path: relPath(paths.stagingHtml) })

      yield event('stage_render', 'running', 'Re-rendering staging PDF...')
      stageRenderPdf(html, paths.stagingPdf)
      yield event('stage_render', 'done', 'Re-rendered staging PDF.', { path: relPath(paths.stagingPdf) })

      yield event('multi_audit', 'running', 'Re-running audits...')
      auditReport = {
        run_id: `${paths.slug}-${Date.now()}-iter-${iterations + 1}`,
        ...stageMultiAudit({ plan, content: contentCurrent, html }),
      }
      writeJson(paths.auditJson, auditReport)
      yield event('multi_audit', 'done', 'Re-audit complete.', { summary: auditReport.summary })
      if ((auditReport.summary?.blockers ?? 0) > 0) throw new Error('Audit blockers found after auto-fix.')
    }

    if (!fs.existsSync(paths.contentFinalJson)) {
      writeJson(paths.contentFinalJson, contentCurrent)
    }

    yield event('final_render', 'running', 'Writing final outputs...')
    const finalMeta = stageFinalRender({
      source,
      plan,
      contentFinal: readJson(paths.contentFinalJson, contentCurrent),
      paths,
      auditReport,
    })
    writeJson(paths.metaJson, {
      slug: paths.slug,
      startedAt: readJson(paths.metaJson, {})?.startedAt ?? null,
      completedAt: nowIso(),
      status: 'complete',
      artifacts: finalMeta,
    })
    yield event('final_render', 'done', 'Lead magnet generated.', {
      slug: paths.slug,
      guideHtml: relPath(paths.guideHtml),
      guidePdf: relPath(paths.guidePdf),
      auditJson: relPath(paths.auditJson),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeJson(paths.metaJson, {
      slug: paths.slug,
      completedAt: nowIso(),
      status: 'error',
      error: message,
    })
    yield event('final_render', 'error', message, { slug: paths.slug })
  }
}

function relPath(absPath) {
  return absPath.split(path.sep).join('/').replace(/^.*\/data\//, 'data/')
}

export function getLeadMagnetArtifacts(slugInput) {
  const paths = leadMagnetPaths(slugInput)
  ensureLeadMagnetDirs(paths)
  const artifacts = [
    { name: 'guide.html', absPath: paths.guideHtml, contentType: 'text/html; charset=utf-8' },
    { name: 'guide.pdf', absPath: paths.guidePdf, contentType: 'application/pdf' },
    { name: 'audit-report.json', absPath: paths.auditJson, contentType: 'application/json; charset=utf-8' },
    { name: 'content.final.json', absPath: paths.contentFinalJson, contentType: 'application/json; charset=utf-8' },
  ]
  return {
    slug: paths.slug,
    files: artifacts
      .filter((x) => fs.existsSync(x.absPath))
      .map((x) => ({
        name: x.name,
        path: relPath(x.absPath),
        size: fs.statSync(x.absPath).size,
        contentType: x.contentType,
      })),
  }
}

export function listLeadMagnetResourceEntries() {
  return listLeadMagnetSlugs()
    .map((slug) => {
      const manifest = getLeadMagnetArtifacts(slug)
      const html = manifest.files.find((x) => x.name === 'guide.html')
      const pdf = manifest.files.find((x) => x.name === 'guide.pdf')
      const audit = manifest.files.find((x) => x.name === 'audit-report.json')
      if (!html || !pdf || !audit) return null
      return {
        id: `lead-magnet-${slug}`,
        slug,
        title: `Lead Magnet — ${slug}`,
        description: 'Generated lead magnet outputs from pipeline runs.',
        htmlPath: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(slug)}&name=guide.html`,
        mdPath: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(slug)}&name=audit-report.json`,
        jsonPath: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(slug)}&name=content.final.json`,
        pdfPath: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(slug)}&name=guide.pdf`,
      }
    })
    .filter(Boolean)
}

export function resolveLeadMagnetFile(slugInput, name) {
  const manifest = getLeadMagnetArtifacts(slugInput)
  const file = manifest.files.find((x) => x.name === name)
  if (!file) return null
  const roots = leadMagnetPaths(manifest.slug)
  const map = new Map([
    ['guide.html', roots.guideHtml],
    ['guide.pdf', roots.guidePdf],
    ['audit-report.json', roots.auditJson],
    ['content.final.json', roots.contentFinalJson],
  ])
  const absPath = map.get(name)
  if (!absPath || !fs.existsSync(absPath)) return null
  return {
    slug: manifest.slug,
    name,
    absPath,
    contentType: manifest.files.find((x) => x.name === name)?.contentType || 'application/octet-stream',
  }
}
