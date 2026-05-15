import topicAnglePresets from '../data/topicAnglePresets.json'

export type TopicAnglePreset = (typeof topicAnglePresets)[number]

/** Presets shipped as JSON so you can edit angles without touching TS pools. */
export const TOPIC_ANGLE_PRESETS: readonly TopicAnglePreset[] = topicAnglePresets

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/**
 * Fills bracket tokens like [GOAL] from small pools so every angle reads as a plausible draft hook.
 */
const POOLS: Record<string, readonly string[]> = {
  SYSTEM_NAME: ['the Pipeline OS', 'Offer Clarity OS', 'the CMO Stack', 'Revenue Rhythm'],
  PROBLEM: ['vague positioning', 'unpredictable pipeline', 'weak differentiation', 'slow trust-building'],
  N: ['3', '4', '5', '6', '7'],
  GOAL: ['ship positioning that converts', 'close bigger retainers', 'build trust before the call', 'raise your fee'],
  LIST: ['clarity, cadence, proof', 'signal, speed, stamina', 'focus, follow-up, follow-through'],
  REFRAME: [
    'the list is not the strategy — the decision is',
    'tactics without narrative cap your upside',
    'consistency beats intensity when trust is the product',
  ],
  REFRAME_CLOSER: ['right on time', 'building signal', 'in the messy middle everyone skips'],
  COMMON_ADVICE: [
    'posting more without a point of view',
    'optimizing for reach instead of resonance',
    'hiring before positioning is sharp',
  ],
  CONTRARIAN_REPLACEMENT: [
    'fewer posts, sharper claims, proof in the thread',
    'one narrative, repeated until it lands',
    'positioning first, then scale',
  ],
  EMBARRASSING_ADMISSION: [
    'rewrite hooks five times before I publish',
    'say yes to the wrong clients when pipeline wobbles',
    'undervalue my own IP when packaging offers',
  ],
  POPULAR_THING: ['\"growth hacks\"', 'busy calendars', 'more tools', 'AI-first workflows'],
  INSIGHT: [
    'the tax is attention — you pay it whether you plan to or not',
    'you optimize for activity, not outcomes',
    'the real bottleneck is decision latency, not talent',
  ],
  PIVOT_MOMENT: [
    'I fired half my clients to fix positioning',
    'I stopped selling hours and started selling outcomes',
    'I realized my best leads came from one story, not ten',
  ],
  PRESENT_TOPIC: ['pricing', 'trust', 'positioning', 'pipeline', 'authority'],
  INTERVIEWS_OR_PROJECTS_OR_YEARS: [
    'dozens of founder interviews',
    '100+ pipeline post-mortems',
    '10 years in the chair',
    '30 fractional engagements',
  ],
  METRIC: ['pipeline', 'reply rate', 'close rate', 'inbound DMs', 'retainer attach rate'],
  TIME_PERIOD: ['Q1', 'the last 90 days', 'this sprint', 'the last launch cycle'],
  BREAKDOWN: [
    'what worked, what flopped, what we changed next',
    'the real numbers vs the story we told ourselves',
    'where we wasted cycles vs where we doubled down',
  ],
  X: ['more content fixes distribution', 'busy equals progress', 'your offer is \"strategy\"'],
  MENTAL_MODEL: [
    'pipeline is a story problem, not a volume problem',
    'positioning is a filter, not a slogan',
    'trust compounds in public, not in decks',
  ],
  SPECIFIC_STRUGGLE: [
    'rebuilding pipeline after a dry quarter',
    'carrying revenue as a solo operator',
    'translating expertise into a sharp offer',
  ],
  OLD_THING: ['Random acts of marketing', 'Generic \"thought leadership\"', 'Activity-based plans'],
  NEW_THING: ['Narrative-led growth', 'Outcome-shaped offers', 'Proof-first positioning'],
  REJECTED_BEHAVIOR: [
    'chase every channel',
    'sell time instead of outcomes',
    'hide the tradeoffs in my work',
  ],
  IDENTITY_CLAIM: [
    'build systems buyers can repeat',
    'sell clarity before capacity',
    'teach what I actually run',
  ],
}

function fillBracketTokens(pattern: string): string {
  return pattern.replace(/\[([A-Z0-9_/]+)\]/g, (full, key: string) => {
    const pool = POOLS[key]
    if (pool?.length) return pick(pool)
    return full
  })
}

/**
 * Single-line topic hook: random angle from the library + bracket tokens filled from phrase pools.
 * No persona line — the Post topic field should stay just the hook you edit.
 */
export function buildRandomTopicFromAngles(angles: readonly TopicAnglePreset[]): string {
  const angle = pick(angles)
  return fillBracketTokens(angle.pattern)
}
