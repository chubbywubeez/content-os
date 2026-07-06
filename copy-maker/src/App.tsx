import { useState } from 'react'
import CopyMakerPage from './CopyMakerPage'
import { InterviewsPage } from './components/InterviewsPage'
import { DemosPage } from './components/DemosPage'
import { PromptManagerPage } from './components/PromptManagerPage'
import { BottomNav, type NavId } from './components/BottomNav'
import { TranscriptImportModal } from './components/TranscriptImportModal'
import { useSupabaseBrowserClient } from './hooks/useSupabaseBrowserClient'
import './index.css'

export default function App() {
  // Hydration-safe client init for upcoming DB reads/writes.
  const supabase = useSupabaseBrowserClient()
  void supabase
  const [page, setPage] = useState<NavId>('content-os')
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  return (
    <div className="cm-app-shell">
      <main className="cm-app-shell__main">
        {page === 'content-os' && <CopyMakerPage />}
        {page === 'interviews' && (
          <InterviewsPage onOpenTranscriptImport={() => setTranscriptOpen(true)} />
        )}
        {page === 'demos' && <DemosPage onOpenTranscriptImport={() => setTranscriptOpen(true)} />}
        {page === 'prompts' && <PromptManagerPage />}
      </main>

      <BottomNav active={page} onChange={setPage} />

      <TranscriptImportModal open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
    </div>
  )
}
