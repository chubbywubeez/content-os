import { useState } from 'react'
import CopyMakerPage from './CopyMakerPage'
import { InterviewsPage } from './components/InterviewsPage'
import { DemosPage } from './components/DemosPage'
import { PromptManagerPage } from './components/PromptManagerPage'
import { ResourcesPage } from './components/ResourcesPage'
import { BottomNav, type NavId } from './components/BottomNav'
import { TranscriptImportModal } from './components/TranscriptImportModal'
import './index.css'

export default function App() {
  const [page, setPage] = useState<NavId>('content-os')
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  function handlePageChange(next: NavId) {
    setPage(next)
    // Keep nav transitions predictable: new section always starts from top.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  return (
    <div className="cm-app-shell">
      <main className="cm-app-shell__main">
        {page === 'content-os' && <CopyMakerPage />}
        {page === 'interviews' && (
          <InterviewsPage onOpenTranscriptImport={() => setTranscriptOpen(true)} />
        )}
        {page === 'demos' && <DemosPage onOpenTranscriptImport={() => setTranscriptOpen(true)} />}
        {page === 'prompts' && <PromptManagerPage />}
        {page === 'resources' && <ResourcesPage />}
      </main>

      <BottomNav active={page} onChange={handlePageChange} />

      <TranscriptImportModal open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
    </div>
  )
}
