import type { CopyMakerState } from '../types/copyMaker'

/** Factory so Reset always returns a fresh object (avoid shared array mutation). */
export function createInitialCopyMakerState(): CopyMakerState {
  return {
    styleGuide: '',
    /** Defaults: Vantum voice, Vantum style guide (loaded via API), BOFU persona. */
    writerVoiceId: 'vantum',
    writerVoiceContent: '',
    customerPersonaId: 'bofu',
    copyModelId: 'opus-4-7',
    imageModelId: 'nano-banana-pro-3',
    customerPersonaContent: '',
    topic: {
      description: '',
    },
    writingFrameworkKind: 'framework',
    writingFrameworkUrn: '',
    writingFrameworkFrameworkMd: '',
    writingFrameworkPostText: '',
    writingFrameworkCustom: '',
    copyGenerations: [],
    copyGenerationIndex: 0,
    selectedPost: '',
    hasChosenFinalPost: false,
    finalPostSaved: false,
    imageContext: '',
    referenceImages: [],
    generatedImageUrl: '',
    imageGenError: '',
  }
}
