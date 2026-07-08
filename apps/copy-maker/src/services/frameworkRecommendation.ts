import type { OutlierCatalogEntry } from '../types/outlierCatalog'

type ScoredFramework = {
  entry: OutlierCatalogEntry
  score: number
}

export type FrameworkRecommendationResult = {
  entry: OutlierCatalogEntry
  score: number
}

const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'against',
  'also',
  'and',
  'are',
  'because',
  'been',
  'before',
  'being',
  'but',
  'can',
  'could',
  'does',
  'doing',
  'for',
  'from',
  'had',
  'has',
  'have',
  'help',
  'her',
  'him',
  'his',
  'how',
  'into',
  'its',
  'just',
  'like',
  'make',
  'more',
  'most',
  'not',
  'our',
  'out',
  'over',
  'post',
  'she',
  'should',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'they',
  'this',
  'through',
  'to',
  'turn',
  'use',
  'was',
  'what',
  'when',
  'where',
  'why',
  'with',
  'you',
  'your',
])

const SYNONYMS: Record<string, string[]> = {
  avoid: ['mistake', 'warning', 'trap', 'wrong', 'ceiling'],
  bad: ['mistake', 'wrong', 'trap'],
  belief: ['myth', 'truth', 'reframe'],
  build: ['system', 'process', 'framework', 'playbook'],
  client: ['case', 'story', 'example'],
  compare: ['contrast', 'versus', 'before', 'after'],
  cost: ['math', 'roi', 'number'],
  example: ['case', 'story', 'proof'],
  fail: ['mistake', 'trap', 'warning'],
  framework: ['system', 'process', 'playbook'],
  growth: ['scale', 'leverage', 'pipeline'],
  lesson: ['truth', 'mistake', 'wisdom'],
  offer: ['positioning', 'promise', 'sales'],
  pain: ['problem', 'trap', 'diagnostic'],
  process: ['framework', 'system', 'steps', 'checklist'],
  proof: ['case', 'example', 'story'],
  roi: ['math', 'cost', 'number'],
  sales: ['offer', 'pipeline', 'positioning'],
  scale: ['system', 'leverage', 'process'],
  story: ['case', 'example', 'proof'],
  system: ['framework', 'process', 'architecture'],
  truth: ['myth', 'hard', 'reframe'],
}

const INTENT_BOOSTS = [
  {
    topicTerms: ['avoid', 'fail', 'mistake', 'wrong', 'trap', 'risk'],
    frameworkTerms: ['mistake', 'trap', 'warning', 'wrong', 'ceiling', 'hard-truth', 'truth'],
  },
  {
    topicTerms: ['how', 'process', 'system', 'framework', 'steps', 'build', 'playbook'],
    frameworkTerms: ['system', 'process', 'step', 'checklist', 'playbook', 'framework', 'architecture'],
  },
  {
    topicTerms: ['story', 'client', 'case', 'example', 'proof'],
    frameworkTerms: ['story', 'case', 'example', 'proof', 'before-after'],
  },
  {
    topicTerms: ['myth', 'belief', 'truth', 'reframe', 'contrarian'],
    frameworkTerms: ['myth', 'truth', 'reframe', 'contrarian', 'hard-truth', 'diagnostic'],
  },
  {
    topicTerms: ['cost', 'roi', 'math', 'numbers', 'revenue', 'price'],
    frameworkTerms: ['math', 'number', 'roi', 'diagnostic', 'scorecard'],
  },
]

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/ies$/, 'y')
    .replace(/s$/, '')
}

function tokenize(text: string): string[] {
  const tokens = text
    .split(/[^a-zA-Z0-9]+/g)
    .map(normalizeToken)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
  return [...new Set(tokens)]
}

function expandTerms(tokens: string[]): string[] {
  const terms = new Set(tokens)
  for (const token of tokens) {
    for (const synonym of SYNONYMS[token] ?? []) terms.add(normalizeToken(synonym))
  }
  return [...terms]
}

function includesTerm(text: string, term: string): boolean {
  if (!term) return false
  return text.includes(term)
}

function scoreEntry(entry: OutlierCatalogEntry, topicTokens: string[], topicTerms: string[]): number {
  const frameworkTags = [
    ...(entry.formatTags ?? []),
    ...(entry.structuralTags ?? []),
    ...(entry.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
  const frameworkName = (entry.frameworkName ?? '').toLowerCase()
  const frameworkPayload = [
    entry.frameworkName,
    entry.frameworkTemplate,
    entry.frameworkBody,
    frameworkTags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  const hookPayload = [entry.creator, entry.hook, entry.textPreview, entry.searchText].join(' ').toLowerCase()
  const postPayload = [entry.postBody, entry.axes].join(' ').toLowerCase()

  let score = Math.log1p(Math.max(0, entry.maxRatio || 0))

  for (const term of topicTerms) {
    if (includesTerm(frameworkTags, term)) score += 8
    if (includesTerm(frameworkName, term)) score += 7
    if (includesTerm(frameworkPayload, term)) score += 4
    if (includesTerm(hookPayload, term)) score += 2
    if (includesTerm(postPayload, term)) score += 1
  }

  for (const token of topicTokens) {
    if (includesTerm(frameworkPayload, token)) score += 2
    if (includesTerm(hookPayload, token)) score += 1
  }

  const topicTermSet = new Set(topicTerms)
  for (const rule of INTENT_BOOSTS) {
    if (!rule.topicTerms.some((term) => topicTermSet.has(normalizeToken(term)))) continue
    for (const frameworkTerm of rule.frameworkTerms) {
      if (includesTerm(frameworkPayload, normalizeToken(frameworkTerm))) score += 5
      if (includesTerm(frameworkTags, normalizeToken(frameworkTerm))) score += 7
    }
  }

  return score
}

function pickWeighted(scored: ScoredFramework[], currentUrn: string): FrameworkRecommendationResult | null {
  if (scored.length === 0) return null
  const bestScore = scored[0]?.score ?? 0
  const floor = Math.max(bestScore * 0.72, bestScore - 16)
  const pool = scored
    .filter((row) => row.score >= floor)
    .slice(0, 12)
  const candidates = pool.length > 0 ? pool : scored.slice(0, 12)
  const total = candidates.reduce((sum, row) => {
    const currentPenalty = row.entry.urn === currentUrn ? 0.55 : 1
    return sum + Math.max(1, row.score) * currentPenalty
  }, 0)
  let pick = Math.random() * total

  for (const row of candidates) {
    const currentPenalty = row.entry.urn === currentUrn ? 0.55 : 1
    pick -= Math.max(1, row.score) * currentPenalty
    if (pick <= 0) return row
  }

  return candidates[candidates.length - 1] ?? null
}

export function recommendFrameworkForTopic(
  entries: OutlierCatalogEntry[],
  topic: string,
  currentUrn = '',
): FrameworkRecommendationResult | null {
  const topicTokens = tokenize(topic)
  if (topicTokens.length === 0) return null

  const topicTerms = expandTerms(topicTokens)
  const candidates = entries.filter((entry) => entry.hasFramework && entry.frameworkBody.trim())
  if (candidates.length === 0) return null

  const scored = candidates
    .map((entry) => ({ entry, score: scoreEntry(entry, topicTokens, topicTerms) }))
    .sort((a, b) => b.score - a.score || (b.entry.maxRatio || 0) - (a.entry.maxRatio || 0))

  return pickWeighted(scored, currentUrn)
}

export function frameworkPickLabel(entry: OutlierCatalogEntry): string {
  const name = entry.frameworkName?.trim()
  if (name && name !== 'Unnamed framework') return name
  const hook = entry.hook.replace(/\s+/g, ' ').trim()
  if (hook) return hook.length > 64 ? `${hook.slice(0, 63)}...` : hook
  return entry.creator || 'Selected framework'
}
