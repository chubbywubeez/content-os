import fs from 'node:fs'
import { SKILL_SCORING } from './paths.mjs'
import { openRouterChat } from './openRouter.mjs'

export const DEFAULT_SCORING_SYSTEM = `You are a rigorous customer discovery analyst. The user message contains the full \
Vantum Interview Scoring rubric (v2) followed by an interview transcript in Markdown.

Apply the rubric exactly: fill every section and table in the template with substantive content.
Use transcript evidence only for numeric scores and quotes. When in doubt, score lower (per rubric).
For OUTPUT 6 (Post-Call Commitment): you only have the transcript — mark post-call behavior as \
**N/A — transcript only** and apply the rubric's interim rule (redistribute that weight to Hypothesis Fit \
for the composite).
Output a single Markdown document (no JSON wrapper). Preserve the rubric's headings and structure.`

/**
 * @param {{ transcriptMd: string, transcriptFileName: string }} input
 */
export async function gradeTranscript(input, prompts = {}) {
  const rubric = prompts.grade_rubric
    ? String(prompts.grade_rubric)
    : fs.existsSync(SKILL_SCORING)
      ? fs.readFileSync(SKILL_SCORING, 'utf8')
      : null
  if (!rubric) throw new Error(`Scoring skill missing: ${SKILL_SCORING}`)
  const userBody =
    rubric.trimEnd() +
    '\n\n---\n\n## TRANSCRIPT (Markdown)\n\n' +
    `*File:* \`${input.transcriptFileName}\`\n\n` +
    input.transcriptMd.trim() +
    '\n'

  const { text, model } = await openRouterChat({
    system: prompts.grade_system || DEFAULT_SCORING_SYSTEM,
    user: userBody,
    temperature: 0.15,
    max_tokens: 64_000,
    timeoutMs: 900_000,
  })

  const header =
    `<!-- Auto-generated interview score -->\n` +
    `*Source transcript:* \`${input.transcriptFileName}\`\n` +
    `*Model:* \`${model}\`\n` +
    `*Skill:* \`data/skills/Vantum_Scoring_Prompt_v2.md\`\n\n` +
    `---\n\n`

  return header + text + '\n'
}

/** Parse classification + composite from score markdown for UI. */
export function parseScoreSummary(scoreMd) {
  const classM =
    scoreMd.match(/##\s*CLASSIFICATION\s*\n+\*\*([A-E])\s*[—–-]\s*([^*]+?)\*\*/i) ||
    scoreMd.match(/(?:Classification|CLASSIFY)\s*:\s*\*?\*?\s*([A-E])\s*[—–-]\s*([^\n*]+)/i)
  const compM = scoreMd.match(/\*\*[^*\n]*?(?:Interim\s+)?Composite\s+Score:\s*([\d.]+)\s*\/\s*100\*\*/i)
  const hypM = scoreMd.match(/(?:\*\*)?Normalized\s+Hypothesis\s+Score:?\s*\*?\*?\s*([\d.]+)\s*%/i)
  return {
    classification: classM ? `${classM[1].toUpperCase()} — ${classM[2].trim().slice(0, 80)}` : null,
    composite: compM ? Number(compM[1]) : null,
    hypothesisPct: hypM ? `${hypM[1]}%` : null,
  }
}
