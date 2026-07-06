/**
 * Parse Google Meet / Zoom-style exports:
 *   M:SS - Speaker Name
 *   dialogue lines...
 *
 * After LLM relabel, parse:
 *   BRIAN: dialogue...
 *   TABARAK: dialogue...
 *   JILL: dialogue...
 */

const TS_LINE = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(.+)$/
const VANTUM_SPEAKER = /\b(brian|tabarak|vantum|tupac)\b/i
const LABEL_LINE = /^(\[[^\]]+\]\s*)?([A-Za-z][A-Za-z0-9 '&.,-]{0,72}):\s*(.*)$/
const UNCERTAIN_LINE = /^\[UNCERTAIN ATTRIBUTION\]\s*$/i
const JUNK_SPEAKER = /unidentified|unknown|note\s*taker|notetaker/i

/**
 * @param {string} speaker
 */
export function isVantumSpeaker(speaker) {
  return VANTUM_SPEAKER.test(speaker)
}

/**
 * @param {string} raw
 */
export function cleanRawTranscript(raw) {
  return raw
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\0/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

/**
 * @param {string} cleaned
 */
export function parseSpeakerDialogue(cleaned) {
  const lines = cleaned.split('\n')
  let title = ''
  let dateLine = ''
  let bodyStart = 0

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (!title && !TS_LINE.test(line) && !/^\w{3},/i.test(line) && !LABEL_LINE.test(line)) {
      title = line
      continue
    }
    if (!dateLine && /^\w{3},/i.test(line)) {
      dateLine = line
      bodyStart = i + 1
      continue
    }
    if (TS_LINE.test(line) || LABEL_LINE.test(line)) {
      bodyStart = i
      break
    }
  }

  /** @type {{ time: string, speaker: string, text: string }[]} */
  const turns = []
  let current = null

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(TS_LINE)
    if (m) {
      if (current && current.text.trim()) turns.push(current)
      current = { time: m[1], speaker: m[2].trim(), text: '' }
      continue
    }
    if (!current) continue
    const t = line.trim()
    if (!t) {
      if (current.text) current.text += '\n'
      continue
    }
    current.text += (current.text ? '\n' : '') + t
  }
  if (current && current.text.trim()) turns.push(current)

  const speakers = [...new Set(turns.map((t) => t.speaker))]
  const participant = pickParticipant(speakers, turns, title)

  return {
    title: title || 'Call transcript',
    dateLine,
    turns,
    speakers,
    participant,
  }
}

/**
 * Parse LLM output (`NAME: line` blocks). Preserves title/date from a prior parse when provided.
 * @param {string} labeled
 * @param {{ title?: string, dateLine?: string }} [meta]
 */
export function parseLabeledDialogue(labeled, meta = {}) {
  const lines = labeled.split('\n')
  /** @type {{ time: string, speaker: string, text: string }[]} */
  const turns = []
  let current = null
  let pendingUncertain = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()
    if (!trimmed) {
      if (current?.text) current.text += '\n'
      continue
    }
    if (UNCERTAIN_LINE.test(trimmed)) {
      pendingUncertain = true
      continue
    }

    const labelMatch = trimmed.match(LABEL_LINE)
    if (labelMatch) {
      if (current?.text.trim()) turns.push(current)
      const prefix = pendingUncertain ? '[UNCERTAIN ATTRIBUTION] ' : ''
      pendingUncertain = false
      current = {
        time: '',
        speaker: normalizeSpeakerName(labelMatch[2]),
        text: prefix + (labelMatch[3] ?? '').trim(),
      }
      continue
    }

    if (!current) continue
    const chunk = trimmed
    current.text += (current.text ? '\n' : '') + chunk
  }
  if (current?.text.trim()) turns.push(current)

  const speakers = [...new Set(turns.map((t) => t.speaker))]
  const title = meta.title || 'Call transcript'
  const participant = pickParticipant(speakers, turns, title)

  return {
    title,
    dateLine: meta.dateLine || '',
    turns,
    speakers,
    participant,
  }
}

/**
 * @param {string} name
 */
function normalizeSpeakerName(name) {
  const n = name.trim()
  if (/^brian$/i.test(n)) return 'Brian'
  if (/^(tabarak|tupac)$/i.test(n)) return 'Tabarak'
  return n
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Best-effort interviewee name before LLM relabel (title + non-Vantum speaker).
 * @param {ReturnType<typeof parseSpeakerDialogue>} parsed
 */
export function inferIntervieweeHint(parsed) {
  const titleHint = parsed.title.match(/&\s*([^,&]+?)(?:\s+Connect|\s+Demo|\s*$)/i)?.[1]?.trim()
  if (titleHint) return titleHint

  const real = parsed.speakers.filter((s) => !JUNK_SPEAKER.test(s) && !isVantumSpeaker(s))
  if (real.length === 1) return real[0]

  const counts = new Map()
  for (const t of parsed.turns) {
    if (JUNK_SPEAKER.test(t.speaker) || isVantumSpeaker(t.speaker)) continue
    counts.set(t.speaker, (counts.get(t.speaker) || 0) + t.text.length)
  }
  let best = ''
  let bestLen = 0
  for (const [name, len] of counts) {
    if (len > bestLen) {
      bestLen = len
      best = name
    }
  }
  return best || real[0] || 'Participant'
}

function pickParticipant(speakers, turns, title) {
  const titleHint = title.match(/&\s*([^,&]+?)(?:\s+Connect|\s+Demo|\s*$)/i)?.[1]?.trim()
  if (titleHint) {
    const fromTitle = speakers.find(
      (s) => !JUNK_SPEAKER.test(s) && s.toLowerCase().includes(titleHint.toLowerCase()),
    )
    if (fromTitle) return fromTitle
  }

  const filtered = speakers.filter((s) => !JUNK_SPEAKER.test(s) && !isVantumSpeaker(s))
  const counts = new Map()
  for (const t of turns) {
    if (JUNK_SPEAKER.test(t.speaker) || isVantumSpeaker(t.speaker)) continue
    counts.set(t.speaker, (counts.get(t.speaker) || 0) + t.text.length)
  }
  let best = ''
  let bestLen = 0
  for (const [name, len] of counts) {
    if (len > bestLen) {
      bestLen = len
      best = name
    }
  }
  if (best) return best
  return filtered[0] || speakers.find((s) => !isVantumSpeaker(s)) || speakers[0] || 'Participant'
}

/**
 * @param {{ title: string, dateLine: string, turns: { time: string, speaker: string, text: string }[], participant: string }} parsed
 */
export function dialogueToMarkdown(parsed) {
  const parts = [`# ${parsed.title}`, '']
  if (parsed.dateLine) parts.push(`*${parsed.dateLine}*`, '')
  parts.push('---', '', '## Dialogue', '')
  for (const t of parsed.turns) {
    const head = t.time ? `**${t.speaker}** (${t.time})` : `**${t.speaker}**`
    parts.push(head, '', t.text.trim(), '')
  }
  return parts.join('\n').trimEnd() + '\n'
}

/**
 * Interview file stem for scores/quotes (matches existing naming).
 * @param {string} participant
 * @param {string} [uploadBase]
 */
/**
 * @param {string} participant
 * @param {string} [uploadBase]
 * @param {'interview' | 'demo'} [callType]
 */
export function interviewStem(participant, uploadBase, callType = 'interview') {
  if (uploadBase) {
    const base = uploadBase.replace(/\.[^.]+$/, '').trim()
    if (base.length > 2) return base
  }
  const safe = participant.replace(/[^\w\s-]/g, '').trim()
  const suffix = callType === 'demo' ? 'Demo' : 'Problem Transcript'
  return `${safe} ${suffix}`
}
