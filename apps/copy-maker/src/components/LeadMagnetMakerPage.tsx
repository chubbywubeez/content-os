import { useMemo, useState } from 'react'
import {
  fetchLeadMagnetArtifacts,
  runLeadMagnetPipeline,
} from '../services/leadMagnetPipelineClient'
import {
  LEAD_MAGNET_STEP_ORDER,
  type LeadMagnetArtifactFile,
  type LeadMagnetStepEvent,
} from '../types/leadMagnetPipeline'

/**
 * Lead Magnet Maker:
 * runs 0-9 generation stages and shows artifact links when complete.
 */
export function LeadMagnetMakerPage() {
  type StageRow = {
    step: string
    status: 'pending' | 'running' | 'done' | 'error'
    message: string
    title: string
  }
  const [slug, setSlug] = useState('feast-or-famine')
  const [brief, setBrief] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<StageRow[]>(() =>
    LEAD_MAGNET_STEP_ORDER.map((step) => ({
      step,
      status: 'pending',
      message: '',
      title: step,
    })),
  )
  const [artifactSlug, setArtifactSlug] = useState('')
  const [files, setFiles] = useState<LeadMagnetArtifactFile[]>([])

  const artifactLinks = useMemo(() => {
    if (!artifactSlug) return []
    return files.map((f) => ({
      ...f,
      href: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(artifactSlug)}&name=${encodeURIComponent(f.name)}`,
      downloadHref: `/api/lead-magnet-pipeline/file?slug=${encodeURIComponent(artifactSlug)}&name=${encodeURIComponent(f.name)}&download=1`,
    }))
  }, [artifactSlug, files])

  function updateRow(ev: LeadMagnetStepEvent) {
    setRows((prev) =>
      prev.map((row) =>
        row.step === ev.step
          ? {
              ...row,
              status: ev.status === 'running' ? 'running' : ev.status === 'error' ? 'error' : 'done',
              message: ev.message,
              title: ev.title,
            }
          : row,
      ),
    )
  }

  async function onRun() {
    const trimmedBrief = brief.trim()
    if (!trimmedBrief) {
      setError('Paste a markdown brief before running the pipeline.')
      return
    }
    setError(null)
    setRunning(true)
    setRows(
      LEAD_MAGNET_STEP_ORDER.map((step) => ({
        step,
        status: 'pending',
        message: '',
        title: step,
      })),
    )
    try {
      await runLeadMagnetPipeline({ slug, briefMarkdown: trimmedBrief }, updateRow)
      const manifest = await fetchLeadMagnetArtifacts(slug)
      setArtifactSlug(manifest.slug)
      setFiles(manifest.files)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="cm-lead-page">
      <header className="cm-interviews-page__head">
        <div>
          <p className="cm-interviews-page__eyebrow">Lead Magnet Pipeline</p>
          <h1 className="cm-interviews-page__title">Lead Magnet Maker</h1>
          <p className="cm-interviews-page__sub">
            Build a full lead magnet from a brief using the staged generation pipeline.
          </p>
        </div>
      </header>

      <div className="cm-lead-layout">
        <article className="cm-card cm-lead-panel">
          <div className="cm-field">
            <label className="cm-label" htmlFor="lead-slug">
              Slug
            </label>
            <input
              id="lead-slug"
              className="cm-input"
              placeholder="feast-or-famine"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>

          <div className="cm-field">
            <label className="cm-label" htmlFor="lead-brief">
              Brief markdown
            </label>
            <textarea
              id="lead-brief"
              className="cm-textarea cm-lead-panel__brief"
              placeholder="Paste your markdown brief here..."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>

          <div className="cm-inline-actions">
            <button type="button" className="cm-btn cm-btn--primary" disabled={running} onClick={() => void onRun()}>
              {running ? 'Running pipeline…' : 'Run full pipeline'}
            </button>
          </div>
          {error ? <p className="cm-note cm-note--error">{error}</p> : null}

          {artifactLinks.length ? (
            <div className="cm-lead-artifacts">
              <p className="cm-label">Artifacts ({artifactSlug})</p>
              <ul className="cm-lead-artifacts__list">
                {artifactLinks.map((f) => (
                  <li key={f.name} className="cm-lead-artifacts__row">
                    <a className="cm-oc__link" href={f.href} target="_blank" rel="noreferrer">
                      {f.name}
                    </a>
                    <a className="cm-btn cm-btn--small" href={f.downloadHref}>
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>

        <aside className="cm-card cm-lead-side">
          <h2 className="cm-lead-side__title">Pipeline stages</h2>
          <ol className="cm-pipeline-rail__steps">
            {rows.map((r) => (
              <li key={r.step} className={`cm-pipeline-rail__step cm-pipeline-rail__step--${r.status}`}>
                <span className="cm-pipeline-rail__step-label">{r.title}</span>
                {r.message ? <span className="cm-pipeline-rail__step-msg">{r.message}</span> : null}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}
