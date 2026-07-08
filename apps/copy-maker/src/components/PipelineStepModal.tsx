import type { PipelineStepEvent } from '../types/transcriptPipeline'

type Props = {
  event: PipelineStepEvent | null
  onConfirm: () => void
}

/**
 * Confirmation modal after each pipeline step completes (or on error).
 */
export function PipelineStepModal({ event, onConfirm }: Props) {
  if (!event) return null

  const isError = event.status === 'error'
  const isRunning = event.status === 'running'

  return (
    <div
      className="cm-modal-backdrop cm-modal-backdrop--step"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cm-pipeline-modal-title"
    >
      <div className={`cm-modal cm-modal--pipeline ${isError ? 'cm-modal--error' : ''}`}>
        <h2 id="cm-pipeline-modal-title" className="cm-modal__title">
          {event.title}
        </h2>
        <p className="cm-modal__message">{event.message}</p>
        {!isRunning ? (
          <div className="cm-modal__actions">
            <button type="button" className="cm-btn cm-btn--primary" onClick={onConfirm}>
              {isError ? 'Close' : 'Continue'}
            </button>
          </div>
        ) : (
          <p className="cm-muted cm-modal__working">Working…</p>
        )}
      </div>
    </div>
  )
}
