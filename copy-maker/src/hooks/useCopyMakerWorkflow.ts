import { useCallback, useEffect, useState } from 'react'
import type { CopyMakerState, CustomerPersonaId, WorkflowSectionId, WriterVoiceId } from '../types/copyMaker'
import { SECTION_ORDER } from '../types/copyMaker'
import { createInitialCopyMakerState } from '../lib/initialState'
import { validateCopyGeneration } from '../services/validation'
import { generateCopyStreaming } from '../services/copyGenerationService'
import { generateNanoBananaImage } from '../services/nanoBananaService'

function nextSectionId(id: WorkflowSectionId): WorkflowSectionId | null {
  const idx = SECTION_ORDER.indexOf(id)
  if (idx === -1 || idx >= SECTION_ORDER.length - 1) return null
  return SECTION_ORDER[idx + 1]!
}

export function useCopyMakerWorkflow() {
  const [state, setState] = useState<CopyMakerState>(() => createInitialCopyMakerState())
  /** Which accordion is expanded; `null` = all collapsed (click a header again to shrink). */
  const [openSection, setOpenSection] = useState<WorkflowSectionId | null>('writerVoice')
  const [copyErrors, setCopyErrors] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)

  /** Loads OS style guide (Vantum) + Vantum voice + BOFU persona — matches createInitialCopyMakerState defaults. */
  const bootstrapOsAssets = useCallback(async () => {
    try {
      const [sgRes, vRes, pRes] = await Promise.all([
        fetch('/api/os/style-guide'),
        fetch('/api/os/writer-voice/vantum'),
        fetch('/api/os/customer-persona/bofu'),
      ])
      const sg = (await sgRes.json()) as { text?: string }
      const v = (await vRes.json()) as { text?: string }
      const p = (await pRes.json()) as { text?: string }
      setState((s) => ({
        ...s,
        styleGuide: typeof sg.text === 'string' ? sg.text : s.styleGuide,
        writerVoiceId: 'vantum',
        writerVoiceContent: typeof v.text === 'string' ? v.text : s.writerVoiceContent,
        customerPersonaId: 'bofu',
        customerPersonaContent: typeof p.text === 'string' ? p.text : s.customerPersonaContent,
      }))
    } catch {
      /* dev server may be unavailable */
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void bootstrapOsAssets()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [bootstrapOsAssets])

  const loadWriterVoice = useCallback(async (id: WriterVoiceId) => {
    try {
      const r = await fetch(`/api/os/writer-voice/${id}`)
      const j = (await r.json()) as { text?: string }
      setState((s) => ({
        ...s,
        writerVoiceId: id,
        writerVoiceContent: typeof j.text === 'string' ? j.text : '',
      }))
    } catch {
      setState((s) => ({ ...s, writerVoiceId: id }))
    }
  }, [])

  const loadCustomerPersona = useCallback(async (id: CustomerPersonaId) => {
    try {
      const r = await fetch(`/api/os/customer-persona/${id}`)
      const j = (await r.json()) as { text?: string }
      setState((s) => ({
        ...s,
        customerPersonaId: id,
        customerPersonaContent: typeof j.text === 'string' ? j.text : '',
      }))
    } catch {
      setState((s) => ({ ...s, customerPersonaId: id }))
    }
  }, [])

  const saveAndContinue = useCallback((section: WorkflowSectionId) => {
    const n = nextSectionId(section)
    if (n) setOpenSection(n)
    else setOpenSection(section)
  }, [])

  /** Click accordion header: open this step, or collapse it if it is already open. */
  const toggleOpenSection = useCallback((id: WorkflowSectionId) => {
    setOpenSection((prev) => (prev === id ? null : id))
  }, [])

  /** Primary button: replaces the whole generation stack with one fresh post (streamed into the card). */
  const runGenerateCopy = useCallback(async () => {
    // Always jump to Generate Copy (collapses Writing Framework) even if validation fails — uses last-selected row.
    setOpenSection('generateCopy')
    const v = validateCopyGeneration(state)
    setCopyErrors(v.errors)
    if (!v.ok) {
      return
    }
    setGenerating(true)
    setState((s) => ({
      ...s,
      copyGenerations: [''],
      copyGenerationIndex: 0,
    }))
    try {
      const body = await generateCopyStreaming(state, (raw) => {
        setState((s) => ({
          ...s,
          copyGenerations: [raw],
          copyGenerationIndex: 0,
        }))
      }, { copyModelId: state.copyModelId })
      setState((s) => ({
        ...s,
        copyGenerations: [body],
        copyGenerationIndex: 0,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copy generation failed.'
      setCopyErrors((prev) => [...prev, message])
      setState((s) => ({ ...s, copyGenerations: [], copyGenerationIndex: 0 }))
    } finally {
      setGenerating(false)
    }
  }, [state])

  const useThisPost = useCallback((body: string) => {
    setState((s) => ({
      ...s,
      selectedPost: body,
      hasChosenFinalPost: true,
      finalPostSaved: false,
    }))
    setOpenSection('finalPost')
  }, [])

  const saveFinal = useCallback(() => {
    setState((s) => ({ ...s, finalPostSaved: true }))
  }, [])

  const openImageSection = useCallback(() => {
    setOpenSection('imageGen')
  }, [])

  /** `regenerateAppend` is only sent when the user is re-running from the image panel (optional refinement box). */
  const runNanoBanana = useCallback(async (regenerateAppend?: string) => {
    setImageLoading(true)
    setState((s) => ({ ...s, imageGenError: '' }))
    try {
      const url = await generateNanoBananaImage({
        finalPost: state.selectedPost,
        imageContext: state.imageContext,
        regenerateAppend: regenerateAppend?.trim() || undefined,
        referenceImages: state.referenceImages.map((r) => ({
          base64: r.base64,
          mimeType: r.mimeType,
        })),
        imageModelChoice: state.imageModelId,
      })
      setState((s) => ({ ...s, generatedImageUrl: url, imageGenError: '' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed.'
      setState((s) => ({ ...s, imageGenError: message }))
    } finally {
      setImageLoading(false)
    }
  }, [state.selectedPost, state.imageContext, state.referenceImages, state.imageModelId])

  const downloadImage = useCallback(() => {
    if (!state.generatedImageUrl) return
    const a = document.createElement('a')
    a.href = state.generatedImageUrl
    a.download = 'content-os-image.png'
    a.click()
  }, [state.generatedImageUrl])

  const startNewPost = useCallback(() => {
    setState((prev) => {
      prev.referenceImages.forEach((img) => URL.revokeObjectURL(img.previewUrl))
      const next = createInitialCopyMakerState()
      return next
    })
    setOpenSection('writerVoice')
    setCopyErrors([])
    setGenerating(false)
    setImageLoading(false)
    void bootstrapOsAssets()
  }, [bootstrapOsAssets])

  /** Appends another full generation (same prompt recipe); user steps through history with chevrons. */
  const regenerateCopy = useCallback(async () => {
    const v = validateCopyGeneration(state)
    setCopyErrors(v.errors)
    if (!v.ok) return
    setGenerating(true)
    setState((s) => {
      const next = [...s.copyGenerations, '']
      return {
        ...s,
        copyGenerations: next,
        copyGenerationIndex: next.length - 1,
      }
    })
    try {
      const body = await generateCopyStreaming(state, (raw) => {
        setState((s) => {
          const gens = [...s.copyGenerations]
          if (gens.length === 0) return s
          gens[gens.length - 1] = raw
          return { ...s, copyGenerations: gens }
        })
      }, { copyModelId: state.copyModelId })
      setState((s) => {
        const gens = [...s.copyGenerations]
        if (gens.length === 0) return s
        gens[gens.length - 1] = body
        return { ...s, copyGenerations: gens }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copy generation failed.'
      setCopyErrors((prev) => [...prev, message])
      setState((s) => {
        const gens = [...s.copyGenerations]
        if (gens.length === 0) return s
        if (gens[gens.length - 1] === '') gens.pop()
        return {
          ...s,
          copyGenerations: gens,
          copyGenerationIndex: Math.max(0, gens.length - 1),
        }
      })
    } finally {
      setGenerating(false)
    }
  }, [state])

  const goPrevGeneration = useCallback(() => {
    setState((s) => ({
      ...s,
      copyGenerationIndex: Math.max(0, s.copyGenerationIndex - 1),
    }))
  }, [])

  const goNextGeneration = useCallback(() => {
    setState((s) => ({
      ...s,
      copyGenerationIndex:
        s.copyGenerations.length === 0
          ? 0
          : Math.min(s.copyGenerations.length - 1, s.copyGenerationIndex + 1),
    }))
  }, [])

  return {
    state,
    setState,
    openSection,
    setOpenSection,
    toggleOpenSection,
    copyErrors,
    generating,
    imageLoading,
    saveAndContinue,
    runGenerateCopy,
    regenerateCopy,
    goPrevGeneration,
    goNextGeneration,
    useThisPost,
    saveFinal,
    openImageSection,
    runNanoBanana,
    downloadImage,
    startNewPost,
    loadWriterVoice,
    loadCustomerPersona,
    bootstrapOsAssets,
  }
}
