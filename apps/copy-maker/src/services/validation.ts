import type { CopyMakerInputs } from '../types/copyMaker'

export type CopyValidationResult = {
  ok: boolean
  errors: string[]
}

/** True when the current framework mode has enough material to generate copy or hit Accept. */
export function writingFrameworkSelectionReady(inputs: CopyMakerInputs): boolean {
  if (inputs.writingFrameworkKind === 'custom') {
    return Boolean(inputs.writingFrameworkCustom.trim())
  }
  if (inputs.writingFrameworkKind === 'framework') {
    return Boolean(inputs.writingFrameworkUrn.trim()) && Boolean(inputs.writingFrameworkFrameworkMd.trim())
  }
  return Boolean(inputs.writingFrameworkUrn.trim()) && Boolean(inputs.writingFrameworkPostText.trim())
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

  const fwOk = writingFrameworkSelectionReady(inputs)

  if (!fwOk) {
    errors.push(
      'Choose a writing framework: pick a post with cached FW for “Framework”, or any post for “Copy examples”, or use Custom.',
    )
  }

  return { ok: errors.length === 0, errors }
}
