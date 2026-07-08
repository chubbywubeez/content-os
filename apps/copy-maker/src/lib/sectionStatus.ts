import type { CopyMakerInputs, CopyMakerState, SectionStatus, WorkflowSectionId } from '../types/copyMaker'

export function statusForStyleGuide(styleGuide: string): SectionStatus {
  const t = styleGuide.trim()
  if (!t) return 'empty'
  if (t.length < 40) return 'draft'
  return 'complete'
}

export function statusForWriterVoice(id: string, content: string): SectionStatus {
  if (!id) return 'empty'
  const t = content.trim()
  if (!t) return 'draft'
  if (t.length < 80) return 'draft'
  return 'complete'
}

export function statusForCustomerPersona(id: string, content: string): SectionStatus {
  if (!id) return 'empty'
  const t = content.trim()
  if (!t) return 'draft'
  if (t.length < 80) return 'draft'
  return 'complete'
}

export function statusForTopic(t: CopyMakerInputs['topic']): SectionStatus {
  if (!t.description.trim()) return 'empty'
  if (t.description.trim().length < 20) return 'draft'
  return 'complete'
}

export function statusForWritingFramework(s: CopyMakerInputs): SectionStatus {
  if (s.writingFrameworkKind === 'custom') {
    if (!(s.writingFrameworkCustom ?? '').trim()) return 'empty'
    return (s.writingFrameworkCustom ?? '').trim().length >= 40 ? 'complete' : 'draft'
  }
  if (!(s.writingFrameworkUrn ?? '').trim()) return 'empty'
  if (s.writingFrameworkKind === 'framework') {
    if (!(s.writingFrameworkFrameworkMd ?? '').trim()) return 'draft'
    return (s.writingFrameworkFrameworkMd ?? '').trim().length >= 120 ? 'complete' : 'draft'
  }
  if (!(s.writingFrameworkPostText ?? '').trim()) return 'draft'
  return (s.writingFrameworkPostText ?? '').trim().length >= 60 ? 'complete' : 'draft'
}

export function statusForGenerateSection(postsCount: number): SectionStatus {
  if (postsCount === 0) return 'empty'
  return 'complete'
}

export function statusForFinalPost(
  finalText: string,
  saved: boolean,
  hasChosen: boolean,
): SectionStatus {
  if (!hasChosen && !finalText.trim()) return 'empty'
  if (!finalText.trim()) return 'draft'
  if (saved) return 'complete'
  return 'draft'
}

export function statusForImage(imageUrl: string): SectionStatus {
  return imageUrl.trim() ? 'complete' : 'empty'
}

export function summaryLabel(status: SectionStatus, imageRow = false): string {
  if (imageRow && status === 'complete') return 'Generated'
  return status === 'empty' ? 'Empty' : status === 'draft' ? 'Draft' : 'Complete'
}

export type SummaryRow = { id: WorkflowSectionId; title: string }

export const SUMMARY_ROWS: SummaryRow[] = [
  { id: 'writerVoice', title: 'Writer Voice' },
  { id: 'styleGuide', title: 'Style Guide' },
  { id: 'customerPersona', title: 'Customer Persona' },
  { id: 'topic', title: 'Topic' },
  { id: 'writingFramework', title: 'Writing Framework' },
  { id: 'generateCopy', title: 'Generated Copy' },
  { id: 'finalPost', title: 'Final Post' },
  { id: 'imageGen', title: 'Image' },
]

export function getSummaryStatus(row: SummaryRow['id'], state: CopyMakerState): SectionStatus {
  switch (row) {
    case 'styleGuide':
      return statusForStyleGuide(state.styleGuide)
    case 'writerVoice':
      return statusForWriterVoice(state.writerVoiceId, state.writerVoiceContent)
    case 'customerPersona':
      return statusForCustomerPersona(state.customerPersonaId, state.customerPersonaContent)
    case 'topic':
      return statusForTopic(state.topic)
    case 'writingFramework':
      return statusForWritingFramework(state)
    case 'generateCopy':
      return statusForGenerateSection(state.copyGenerations.length)
    case 'finalPost':
      return statusForFinalPost(state.selectedPost, state.finalPostSaved, state.hasChosenFinalPost)
    case 'imageGen':
      return statusForImage(state.generatedImageUrl)
    default:
      return 'empty'
  }
}
