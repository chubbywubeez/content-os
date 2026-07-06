/**
 * Infer TOFU / MOFU / BOFU from score markdown (and optional pipeline meta).
 * Matches classifyPersona.mjs criteria using hard-filter gates + classification.
 */

/** @typedef {'tofu' | 'mofu' | 'bofu'} PersonaId */

/**
 * @param {string} scoreMd
 * @returns {{ clientsGate: 'yes' | 'no' | 'unknown', strainGate: 'yes' | 'no' | 'partial' | 'unknown', classLetter: string | null }}
 */
export function parseHardFilterSignals(scoreMd) {
  const section =
    scoreMd.match(/##\s*HARD FILTERS[\s\S]*?(?=\n##\s)/i)?.[0] ??
    scoreMd.slice(0, 4000)

  const clientsGate = gateFromRow(section, /3[–-]4\+ active clients/i)
  const strainGate = gateFromRow(section, /capacity strain/i)
  const classLetter =
    scoreMd.match(/##\s*CLASSIFICATION\s*\n+\*\*([A-E])\s*[—–-]/i)?.[1]?.toUpperCase() ??
    scoreMd.match(/CLASSIFY\s*:\s*\*?\*?\s*([A-E])\s*[—–-]/i)?.[1]?.toUpperCase() ??
    null

  return { clientsGate, strainGate, classLetter }
}

/**
 * @param {string} section
 * @param {RegExp} rowLabel
 */
function gateFromRow(section, rowLabel) {
  const row = section.match(new RegExp(`${rowLabel.source}[^\\n]*\\|[^\\n]*\\|([^\\n|]+)`, 'i'))?.[1]
  if (!row) return 'unknown'
  const t = row.trim()
  if (/PARTIAL\s*\/\s*NO|PARTIAL\/NO/i.test(t)) return 'partial'
  if (/MARGINAL\s*\/\s*NO/i.test(t)) return 'no'
  if (/^\*\*NO\*\*|^\s*NO\s*[—–-]/i.test(t) || /\bNO\b/.test(t) && !/YES/.test(t.split('—')[0] ?? t)) {
    if (/YES/i.test(t) && /NO/i.test(t)) {
      // "**NO** — 2-3 clients" style
      if (/^\*\*NO\*\*|^\s*NO\b/i.test(t)) return 'no'
    } else if (!/YES/i.test(t)) return 'no'
  }
  if (/YES/i.test(t)) return 'yes'
  return 'unknown'
}

/**
 * @param {{ scoreMd: string, composite: number | null, metaPersona?: string | null }} input
 * @returns {PersonaId}
 */
export function inferPersonaFromScore(input) {
  const saved = String(input.metaPersona || '').toLowerCase()
  if (saved === 'tofu' || saved === 'mofu' || saved === 'bofu') return saved

  const { clientsGate, strainGate, classLetter } = parseHardFilterSignals(input.scoreMd)
  const text = input.scoreMd.toLowerCase()

  if (classLetter === 'E' || /disqualify/i.test(input.scoreMd)) return 'tofu'

  const preRevenue =
    /no active (clients|revenue)|pre-revenue|between engagements|not at that point|pipeline-building phase/i.test(
      text,
    )
  const rampUp =
    /ramp-up|below the client count|2–3 active|two to three clients|not enough clients/i.test(text)

  if (clientsGate === 'no' || preRevenue || rampUp) return 'tofu'

  const acuteStrain =
    strainGate === 'yes' ||
    /acute capacity|capacity strain|feast.famine.*overload|reactive overtime|3 am|overwhelmed/i.test(
      text,
    )
  const multiClient = clientsGate === 'yes' || /six (total )?engagements|five clients|four clients/i.test(text)

  if (multiClient && acuteStrain) return 'bofu'

  if (classLetter === 'A' || classLetter === 'B') {
    if (input.composite != null && input.composite >= 60 && multiClient) return 'bofu'
    return 'mofu'
  }

  if (classLetter === 'D') return 'tofu'

  return 'mofu'
}
