export type PersonaId = 'tofu' | 'mofu' | 'bofu'
export type CallType = 'interview' | 'demo'

export type InterviewListItem = {
  stem: string
  displayName: string
  callType: CallType
  persona: PersonaId | null
  grade: string
  composite: number | null
  hasTranscript: boolean
  hasQuotes: boolean
  hasScore?: boolean
}

export type InterviewQuoteSnippet = {
  theme_tag?: string
  pull_quote?: string
  website_angle?: string
  intensity_1_to_5?: number
}

export type InterviewDetail = {
  stem: string
  displayName: string
  callType: CallType
  persona: PersonaId | null
  grade: string
  composite: number | null
  classification: string | null
  hypothesisPct: string | null
  summary: string
  transcript: { markdown: string; path: string } | null
  score: {
    markdown: string
    path: string
    summary: {
      classification: string | null
      composite: number | null
      hypothesisPct: string | null
    }
  } | null
  quotes: {
    interview?: string
    interview_weight?: number
    snippets: InterviewQuoteSnippet[]
  } | null
  meta: {
    callType?: CallType
    persona?: PersonaId
    confidence?: number
    rationale?: string
    classifiedAt?: string
  } | null
}

export type DemosListResponse = {
  count: number
  demos: InterviewListItem[]
  warning?: string
}

export type InterviewsListResponse = {
  count: number
  byPersona: Record<PersonaId, number>
  interviews: InterviewListItem[]
  warning?: string
}
