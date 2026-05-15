import type { CopyMakerInputs } from '../types/copyMaker'

export type CopyValidationResult = {
  ok: boolean
  errors: string[]
}

export function validateCopyGeneration(inputs: CopyMakerInputs): CopyValidationResult {
  const errors: string[] = []

  if (!inputs.topic.description.trim()) {
    errors.push('Add a topic so the model knows what the post is about.')
  }

  const hasStyle = Boolean(inputs.styleGuide.trim())
  const hasVoice = Boolean(inputs.writerVoiceContent.trim())
  const hasPersona = Boolean(inputs.customerPersonaContent.trim())

  if (!hasStyle && !hasVoice && !hasPersona) {
    errors.push(
      'Add at least one of: Style Guide, Writer Voice, or Customer Persona (or ensure OS files loaded).',
    )
  }

  const fwOk =
    inputs.writingFrameworkKind === 'custom'
      ? Boolean(inputs.writingFrameworkCustom.trim())
      : inputs.writingFrameworkKind === 'framework'
        ? Boolean(inputs.writingFrameworkUrn.trim()) &&
          Boolean(inputs.writingFrameworkFrameworkMd.trim())
        : Boolean(inputs.writingFrameworkUrn.trim()) && Boolean(inputs.writingFrameworkPostText.trim())

  if (!fwOk) {
    errors.push(
      'Choose a writing framework: pick a post with cached FW for “Framework”, or any post for “Copy examples”, or use Custom.',
    )
  }

  return { ok: errors.length === 0, errors }
}
