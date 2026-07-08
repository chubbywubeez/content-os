import type { CopyMakerInputs } from '../types/copyMaker'

const MAX_FRAMEWORK_CHARS = 14_000

export const DEFAULT_COPY_PROMPT_TEMPLATE = `You are an expert social copywriter. Generate exactly ONE strong post for the topic below.

{{OUTPUT_CONTRACT}}

Rules:
- {{TOPIC_INSTRUCTION}}
- {{PERSONA_INSTRUCTION}}
- {{VOICE_INSTRUCTION}}
- {{STYLE_GUIDE_INSTRUCTION}}
- {{WRITING_FRAMEWORK_INSTRUCTION}}
- Avoid generic AI voice: no hollow motivation, no vague claims, no filler transitions.
- Keep LinkedIn-style line breaks in mind unless the topic implies another surface.

Priority if instructions conflict:
1) Topic content
2) Customer persona
3) Writer voice
4) Style guide
5) Writing framework

--- TOPIC (primary) ---
{{TOPIC_TEXT}}

--- CUSTOMER PERSONA (full document) ---
{{CUSTOMER_PERSONA_CONTENT}}

--- WRITER VOICE (full document) ---
{{WRITER_VOICE_CONTENT}}

--- STYLE GUIDE (constraints) ---
{{STYLE_GUIDE_CONTENT}}

--- WRITING FRAMEWORK ---
{{WRITING_FRAMEWORK_BLOCK}}
`

function truncateForPrompt(text: string, max: number): { text: string; truncated: boolean } {
  const t = text.trim()
  if (t.length <= max) return { text: t, truncated: false }
  return {
    text: `${t.slice(0, max)}\n\n[…truncated for prompt length]`,
    truncated: true,
  }
}

type CopyPromptOverrides = {
  template?: string
  outputContract?: string
  topicInstruction?: string
  personaInstruction?: string
  voiceInstruction?: string
  styleGuideInstruction?: string
  writingFrameworkInstruction?: string
}

export function buildCopyPrompt(inputs: CopyMakerInputs, overrides: CopyPromptOverrides = {}): string {
  const {
    styleGuide,
    writerVoiceContent,
    customerPersonaContent,
    topic,
    writingFrameworkKind,
    writingFrameworkFrameworkMd,
    writingFrameworkPostText,
    writingFrameworkCustom,
    writingFrameworkUrn,
  } = inputs

  let frameworkBlock: string
  if (writingFrameworkKind === 'custom') {
    frameworkBlock = `Custom structure (author-defined):\n${writingFrameworkCustom.trim() || '(not specified)'}`
  } else if (writingFrameworkKind === 'framework') {
    const { text, truncated } = truncateForPrompt(writingFrameworkFrameworkMd, MAX_FRAMEWORK_CHARS)
    frameworkBlock = [
      'Follow this swipe-file FRAMEWORK: named mechanism + fill-in-the-blank template with [BRACKETED SLOTS].',
      'Use the template as structural scaffolding only - slot in new content for the TOPIC and PERSONA.',
      'Mirror hook shape, beat order, line-break rhythm, CTA placement, and any TYPOGRAPHY / TYPESETTING STYLE notes. If the source used LinkedIn bold/rich text or Unicode emphasis, carry that emphasis pattern forward without copying the source words.',
      'Do NOT copy facts, names, stats, or stories from the reference.',
      `Source URN: ${writingFrameworkUrn || '(unknown)'}`,
      truncated ? 'Note: excerpt was truncated for token safety.' : '',
      '',
      '--- FRAMEWORK (swipe file) ---',
      text || '(empty)',
    ]
      .filter(Boolean)
      .join('\n')
  } else {
    const { text, truncated } = truncateForPrompt(writingFrameworkPostText, MAX_FRAMEWORK_CHARS)
    frameworkBlock = [
      'Use this high-performing OUTLIER POST as a COPY PATTERN for rhythm, pacing, line breaks, and rhetorical moves only.',
      'Notice typography too: bold/rich text, Unicode emphasis, list markers, short-line rhythm, and spacing are part of the pattern when present.',
      'Do NOT copy facts, stories, names, or claims. Adapt the pattern to the TOPIC and PERSONA.',
      `Source URN: ${writingFrameworkUrn || '(unknown)'}`,
      truncated ? 'Note: excerpt was truncated for token safety.' : '',
      '',
      '--- REFERENCE POST (verbatim for pattern only) ---',
      text || '(empty)',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const template = overrides.template || DEFAULT_COPY_PROMPT_TEMPLATE
  return template
    .replace(
      '{{OUTPUT_CONTRACT}}',
      overrides.outputContract ||
        `OUTPUT FORMAT (strict JSON only, no markdown fences):\n{\n  "body": "full post text with appropriate line breaks"\n}`,
    )
    .replace(
      '{{TOPIC_INSTRUCTION}}',
      overrides.topicInstruction || 'The TOPIC is the central subject. Everything must serve the topic.',
    )
    .replace(
      '{{PERSONA_INSTRUCTION}}',
      overrides.personaInstruction || 'Write for the CUSTOMER PERSONA (full persona text below).',
    )
    .replace(
      '{{VOICE_INSTRUCTION}}',
      overrides.voiceInstruction || 'Use the WRITER VOICE document as how it should sound.',
    )
    .replace(
      '{{STYLE_GUIDE_INSTRUCTION}}',
      overrides.styleGuideInstruction ||
        'Treat the STYLE GUIDE as hard constraints (tone, taboos, formatting).',
    )
    .replace(
      '{{WRITING_FRAMEWORK_INSTRUCTION}}',
      overrides.writingFrameworkInstruction ||
        'Follow the WRITING FRAMEWORK section for structure / pattern.',
    )
    .replace('{{TOPIC_TEXT}}', topic.description.trim() || '(missing)')
    .replace('{{CUSTOMER_PERSONA_CONTENT}}', customerPersonaContent.trim() || '(not provided)')
    .replace('{{WRITER_VOICE_CONTENT}}', writerVoiceContent.trim() || '(not provided)')
    .replace('{{STYLE_GUIDE_CONTENT}}', styleGuide.trim() || '(not provided)')
    .replace('{{WRITING_FRAMEWORK_BLOCK}}', frameworkBlock)
}
