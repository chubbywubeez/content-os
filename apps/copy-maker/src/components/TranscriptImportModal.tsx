import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PipelineStepEvent } from '../types/transcriptPipeline'
import { PIPELINE_STEP_ORDER } from '../types/transcriptPipeline'
import { runTranscriptPipelineUpload } from '../services/transcriptPipelineClient'
import { PipelineStepModal } from './PipelineStepModal'

type StepRow = {
  step: string
  status: 'pending' | 'running' | 'done' | 'error'
  title: string
  message?: string
}

type Props = {
  open: boolean
  onClose: () => void
}

function labelForStep(step: string): string {
  const labels: Record<string, string> = {
    upload: 'Upload',
    clean: 'Clean text',
    classify_call: 'Call type',
    relabel: 'Relabel speakers',
    speakers: 'Speaker breakdown',
    chunk_pass1: 'Chunk transcript',
    chunk_pass2: 'Interpret chunks',
    save_transcript: 'Save transcript',
    grade: 'Grade interview',
    grading_sheet: 'Grading sheet',
    extract_quotes: 'Extract quotes',
    quote_docs: 'Quote documents',
    classify_persona: 'Persona stage',
    update_persona: 'Update persona',
    sync_resources: 'Sync resources',
    linkedin_enrich: 'LinkedIn enrich',
    complete: 'Done',
  }
  return labels[step] ?? step
}

function initialRows(): StepRow[] {
  return PIPELINE_STEP_ORDER.map((step) => ({
    step,
    status: 'pending',
    title: labelForStep(step),
  }))
}

/**
 * Centered full-viewport modal for the transcript pipeline (portaled above the app).
 */
export function TranscriptImportModal({ open, onClose }: Props) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const modalBusyRef = useRef(false)
  const doneQueueRef = useRef<PipelineStepEvent[]>([])

  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<StepRow[]>(initialRows)
  const [stepModalEvent, setStepModalEvent] = useState<PipelineStepEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkedinUrl, setLinkedinUrl] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, onClose])

  function updateRow(ev: PipelineStepEvent) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.step !== ev.step) return r
        return {
          ...r,
          status: ev.status === 'error' ? 'error' : ev.status === 'running' ? 'running' : 'done',
          message: ev.message,
        }
      }),
    )
  }

  function showDoneOrError(ev: PipelineStepEvent) {
    if (!modalBusyRef.current) {
      modalBusyRef.current = true
      setStepModalEvent(ev)
    } else {
      doneQueueRef.current.push(ev)
    }
  }

  function handleStepModalConfirm() {
    if (stepModalEvent?.status === 'error') {
      modalBusyRef.current = false
      doneQueueRef.current = []
      setStepModalEvent(null)
      setRunning(false)
      return
    }
    const next = doneQueueRef.current.shift()
    if (next) {
      setStepModalEvent(next)
    } else {
      modalBusyRef.current = false
      setStepModalEvent(null)
    }
  }

  function onPipelineEvent(ev: PipelineStepEvent) {
    updateRow(ev)
    if (ev.status === 'running') return
    if (ev.status === 'done') {
      showDoneOrError(ev)
      if (ev.step === 'complete') setRunning(false)
    }
    if (ev.status === 'error') {
      showDoneOrError(ev)
      setRunning(false)
    }
  }

  async function onFile(file: File) {
    setError(null)
    setRunning(true)
    setRows(initialRows())
    doneQueueRef.current = []
    modalBusyRef.current = false

    try {
      await runTranscriptPipelineUpload(file, onPipelineEvent, { linkedinUrl: linkedinUrl.trim() })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pipeline failed'
      setError(msg)
      setRunning(false)
      modalBusyRef.current = true
      setStepModalEvent({
        step: 'error',
        status: 'error',
        title: 'Pipeline failed',
        message: msg,
      })
    }
  }

  if (!open) return null

  return createPortal(
    <>
      <div className="cm-modal-root">
        <button
          type="button"
          className="cm-modal-backdrop"
          aria-label="Close dialog"
          disabled={running}
          onClick={() => {
            if (!running) onClose()
          }}
        />
        <div
          className="cm-modal cm-transcript-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="cm-modal__head">
            <div>
              <div className="cm-transcript-modal__eyebrow">Research pipeline</div>
              <h2 id={titleId} className="cm-modal__title">
                Transcript Import
              </h2>
            </div>
            <button
              type="button"
              className="cm-modal__close"
              aria-label="Close"
              disabled={running}
              onClick={onClose}
            >
              ×
            </button>
          </header>

          <div className="cm-transcript-modal__body">
            <p className="cm-transcript-modal__hint">
              Upload a Meet/Zoom transcript (.txt). We classify interview vs product demo, fix speaker labels,
              chunk the transcript, then run the interview path (grade, TOFU/MOFU/BOFU) or demo path
              (transcript + quotes only).
            </p>

            <label className="cm-field">
              <span className="cm-field__label">LinkedIn URL (optional)</span>
              <input
                type="url"
                className="cm-input"
                placeholder="https://www.linkedin.com/in/person-slug/"
                value={linkedinUrl}
                disabled={running}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
            </label>

            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,text/plain"
              className="cm-pipeline-rail__file"
              disabled={running}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="cm-btn cm-btn--primary cm-transcript-modal__upload"
              disabled={running}
              onClick={() => inputRef.current?.click()}
            >
              {running ? 'Pipeline running…' : 'Choose transcript file'}
            </button>

            {error ? <p className="cm-note cm-note--warn">{error}</p> : null}

            <ol className="cm-pipeline-rail__steps cm-transcript-modal__steps">
              {rows.map((r) => (
                <li key={r.step} className={`cm-pipeline-rail__step cm-pipeline-rail__step--${r.status}`}>
                  <span className="cm-pipeline-rail__step-label">{r.title}</span>
                  {r.message ? <span className="cm-pipeline-rail__step-msg">{r.message}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <PipelineStepModal event={stepModalEvent} onConfirm={handleStepModalConfirm} />
    </>,
    document.body,
  )
}
