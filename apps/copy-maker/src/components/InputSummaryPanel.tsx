import { useState } from 'react'
import type { CopyMakerState, WorkflowSectionId } from '../types/copyMaker'
import { getSummaryStatus, summaryLabel } from '../lib/sectionStatus'
import { validateCopyGeneration } from '../services/validation'
import { TranscriptImportModal } from './TranscriptImportModal'

type Props = {
  state: CopyMakerState
  generating: boolean
  onGenerateCopy: () => void
}

type Row = { id: WorkflowSectionId; title: string }

const WORK_ROWS: Row[] = [
  { id: 'topic', title: 'Topic' },
  { id: 'writingFramework', title: 'Framework' },
  { id: 'generateCopy', title: 'Generated Copy' },
  { id: 'finalPost', title: 'Final Post' },
  { id: 'imageGen', title: 'Image' },
]

const CONTEXT_ROWS: Row[] = [
  { id: 'writerVoice', title: 'Voice' },
  { id: 'styleGuide', title: 'Style' },
  { id: 'customerPersona', title: 'Persona' },
]

const VOICE_LABELS: Record<string, string> = {
  vantum: 'Vantum',
  tabarak: 'Tabarak',
  brian: 'Brian',
}

const PERSONA_LABELS: Record<string, string> = {
  tofu: 'TOFU',
  mofu: 'MOFU',
  bofu: 'BOFU',
}

function getNextStep(state: CopyMakerState, canGenerate: boolean): string {
  if (getSummaryStatus('topic', state) !== 'complete') return 'Add the post topic'
  if (getSummaryStatus('writingFramework', state) !== 'complete') return 'Pick the writing framework'
  if (state.copyGenerations.length === 0) return canGenerate ? 'Ready to generate copy' : 'Check required inputs'
  if (!state.hasChosenFinalPost) return 'Pick a version with Use this, or keep regenerating'
  if (getSummaryStatus('finalPost', state) !== 'complete') return 'Save the final post'
  if (!state.generatedImageUrl) return 'Generate the companion image'
  return 'Ready for the next post'
}

/**
 * Right rail: active workflow progress, primary copy CTA, and quiet loaded-context summary.
 */
export function InputSummaryPanel({ state, generating, onGenerateCopy }: Props) {
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const validation = validateCopyGeneration(state)
  const canGenerate = validation.ok && !generating
  const nextStep = getNextStep(state, validation.ok)

  return (
    <div className="cm-summary-column">
      <aside className="cm-summary" aria-label="Workflow status">
      <div className="cm-summary__eyebrow">Next Step</div>
      <div className="cm-summary__next">{nextStep}</div>
      {validation.errors.length > 0 && state.copyGenerations.length === 0 && (
        <p className="cm-summary__hint">{validation.errors[0]}</p>
      )}
      <button
        type="button"
        className="cm-btn cm-btn--primary cm-summary__cta"
        disabled={!canGenerate}
        onClick={onGenerateCopy}
      >
        {generating ? 'Generating...' : 'Generate Copy'}
      </button>

      <div className="cm-summary__section">
        <div className="cm-summary__title">Workflow</div>
        <ul className="cm-summary__list">
          {WORK_ROWS.map((row) => {
            const st = getSummaryStatus(row.id, state)
            const label = summaryLabel(st, row.id === 'imageGen')
            return (
              <li key={row.id} className="cm-summary__row">
                <span>{row.title}</span>
                <span className={`cm-summary__pill cm-summary__pill--${st}`}>{label}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="cm-summary__section cm-summary__section--context">
        <div className="cm-summary__title">Loaded Context</div>
        <div className="cm-summary__meta">
          <span>{VOICE_LABELS[state.writerVoiceId] ?? 'No voice'}</span>
          <span>{PERSONA_LABELS[state.customerPersonaId] ?? 'No persona'}</span>
        </div>
        <ul className="cm-summary__list">
          {CONTEXT_ROWS.map((row) => {
            const st = getSummaryStatus(row.id, state)
            return (
              <li key={row.id} className="cm-summary__row">
                <span>{row.title}</span>
                <span className={`cm-summary__pill cm-summary__pill--${st}`}>{summaryLabel(st)}</span>
              </li>
            )
          })}
        </ul>
      </div>
      </aside>

      <button
        type="button"
        className="cm-btn cm-summary__transcript"
        onClick={() => setTranscriptOpen(true)}
      >
        Transcript Import
      </button>

      <TranscriptImportModal open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
    </div>
  )
}
