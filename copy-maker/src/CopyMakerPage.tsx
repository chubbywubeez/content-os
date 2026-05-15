import { useState } from 'react'
import { CopyMakerHeader } from './components/CopyMakerHeader'
import { CopyMakerWorkflow } from './components/CopyMakerWorkflow'
import { InputSummaryPanel } from './components/InputSummaryPanel'
import { useCopyMakerWorkflow } from './hooks/useCopyMakerWorkflow'

/**
 * Content OS: single-page shell — header, left workflow, right summary (collapses on small screens).
 */
export default function CopyMakerPage() {
  const wf = useCopyMakerWorkflow()
  const [showMobileSummary, setShowMobileSummary] = useState(false)

  return (
    <div className="cm-page">
      <CopyMakerHeader
        copyModelId={wf.state.copyModelId}
        imageModelId={wf.state.imageModelId}
        onCopyModelChange={(id) => wf.setState((s) => ({ ...s, copyModelId: id }))}
        onImageModelChange={(id) => wf.setState((s) => ({ ...s, imageModelId: id }))}
      />

      <div className="cm-mobile-summary-toggle">
        <button type="button" className="cm-btn cm-btn--ghost" onClick={() => setShowMobileSummary((v) => !v)}>
          {showMobileSummary ? 'Hide workflow status' : 'Show workflow status'}
        </button>
      </div>

      <div className="cm-layout">
        <CopyMakerWorkflow wf={wf} />
        <div className={`cm-summary-wrap ${showMobileSummary ? 'cm-summary-wrap--open' : ''}`}>
          <InputSummaryPanel
            state={wf.state}
            generating={wf.generating}
            onGenerateCopy={() => void wf.runGenerateCopy()}
          />
        </div>
      </div>
    </div>
  )
}
