import { useEffect, useRef, useState } from 'react'
import { AccordionSection } from './AccordionSection'
import { TextAreaField } from './TextAreaField'
import { SelectField } from './SelectField'
import { FinalPostEditor } from './FinalPostEditor'
import { ImageGenerationPanel } from './ImageGenerationPanel'
import { OutlierCatalogPicker } from './OutlierCatalogPicker'
import { EditContextModal } from './EditContextModal'
import { GearEditButton } from './GearEditButton'
import { getSummaryStatus, statusForTopic } from '../lib/sectionStatus'
import { writingFrameworkSelectionReady } from '../services/validation'
import { useCopyMakerWorkflow } from '../hooks/useCopyMakerWorkflow'
import { useOutliersCatalog } from '../hooks/useOutliersCatalog'
import type { CustomerPersonaId, WriterVoiceId } from '../types/copyMaker'
import { buildRandomTopicFromAngles } from '../lib/topicAngleRandomTopic'
import { useTopicAngleLibrary } from '../hooks/useTopicAngleLibrary'

type Wf = ReturnType<typeof useCopyMakerWorkflow>

type Props = { wf: Wf }

const WRITER_VOICE_OPTIONS: { value: WriterVoiceId; label: string }[] = [
  { value: 'vantum', label: 'Vantum' },
  { value: 'tabarak', label: 'Tabarak' },
  { value: 'brian', label: 'Brian' },
]

const PERSONA_OPTIONS: { value: CustomerPersonaId; label: string }[] = [
  { value: 'tofu', label: 'TOFU' },
  { value: 'mofu', label: 'MOFU' },
  { value: 'bofu', label: 'BOFU' },
]

type ContextModalKind = 'writerVoice' | 'styleGuide' | 'customerPersona'

export function CopyMakerWorkflow({ wf }: Props) {
  const [contextModal, setContextModal] = useState<ContextModalKind | null>(null)
  /** Gear menu for Post topic: random generator + read-only angle library from JSON. */
  const [topicToolsOpen, setTopicToolsOpen] = useState(false)
  const topicToolsRef = useRef<HTMLDivElement | null>(null)
  const {
    committedPresets,
    draftJson,
    setDraftJson,
    saveDraft,
    resetToDefaults,
    syncDraftFromCommitted,
    saveError,
  } = useTopicAngleLibrary()
  const cat = useOutliersCatalog()
  const {
    state,
    setState,
    openSection,
    toggleOpenSection,
    copyErrors,
    generating,
    imageLoading,
    saveAndContinue,
    runGenerateCopy,
    useThisPost: selectGeneratedPost,
    saveFinal,
    openImageSection,
    runNanoBanana,
    downloadImage,
    startNewPost,
    regenerateCopy,
    goPrevGeneration,
    goNextGeneration,
    loadWriterVoice,
    loadCustomerPersona,
  } = wf

  useEffect(() => {
    if (!topicToolsOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const el = topicToolsRef.current
      if (el && !el.contains(e.target as Node)) setTopicToolsOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTopicToolsOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [topicToolsOpen])

  /** Opening the gear resets the JSON editor to the last saved angle library. */
  useEffect(() => {
    if (topicToolsOpen) syncDraftFromCommitted()
  }, [topicToolsOpen, syncDraftFromCommitted])

  const topicComplete = statusForTopic(state.topic) === 'complete'
  const copyReady = topicComplete && getSummaryStatus('writingFramework', state) === 'complete'

  const gens = state.copyGenerations
  const genCount = gens.length
  const genSafeIdx = genCount ? Math.min(state.copyGenerationIndex, genCount - 1) : 0
  const currentGeneratedBody = genCount ? (gens[genSafeIdx] ?? '') : ''
  const canGoPrevGen = genCount > 1 && genSafeIdx > 0 && !generating
  const canGoNextGen = genCount > 1 && genSafeIdx < genCount - 1 && !generating

  function optionLabel<T extends string>(id: string, options: { value: T; label: string }[]): string {
    if (!id) return '—'
    const o = options.find((x) => x.value === id)
    return o?.label ?? id
  }

  /** Fills the topic box with one random hook line from the angle library (see `topicAngleRandomTopic.ts`). */
  function applyRandomTopicToField() {
    const text = buildRandomTopicFromAngles(committedPresets)
    setState((s) => ({ ...s, topic: { description: text } }))
  }

  function topicSubtitle(): string | undefined {
    const t = state.topic.description.replace(/\s+/g, ' ').trim()
    if (!t) return 'Empty'
    return t.length > 72 ? `${t.slice(0, 71)}...` : t
  }

  function frameworkSubtitle(): string | undefined {
    if (state.writingFrameworkKind === 'custom') {
      const t = state.writingFrameworkCustom.trim()
      if (!t) return 'Custom (empty)'
      return t.length > 64 ? `${t.slice(0, 63)}...` : `Custom: ${t}`
    }
    if (!state.writingFrameworkUrn?.trim()) return 'None selected'
    const e = cat.entries.find((x) => x.urn === state.writingFrameworkUrn)
    if (e) {
      const hook = (e.hook || 'Post').replace(/\s+/g, ' ').trim()
      const h = hook.length > 42 ? `${hook.slice(0, 41)}...` : hook
      return `${e.creator} — ${h}`
    }
    return state.writingFrameworkUrn
  }

  function generateSubtitle(): string | undefined {
    const n = state.copyGenerations.length
    if (!n) return 'Not generated'
    const idx = Math.min(state.copyGenerationIndex, n - 1)
    return `Version ${idx + 1} of ${n}`
  }

  function finalSubtitle(): string | undefined {
    if (state.finalPostSaved) return 'Saved'
    if (state.hasChosenFinalPost && state.selectedPost.trim()) return 'Draft'
    if (state.hasChosenFinalPost) return 'Chosen'
    return 'Not started'
  }

  function imageSubtitle(): string | undefined {
    if (state.generatedImageUrl?.trim()) return 'Image ready'
    return 'Not generated'
  }

  /**
   * Catalog row click only updates selection + preview data. User must click "Accept & continue"
   * to advance — or use "Generate Copy" (uses last selection and opens Generate Copy, collapses this step).
   */
  function applyWritingPick(e: (typeof cat.entries)[0]) {
    setState((s) => ({
      ...s,
      writingFrameworkUrn: e.urn,
      writingFrameworkFrameworkMd: e.frameworkBody,
      writingFrameworkPostText: e.postBody,
    }))
  }

  /** Confirms framework choice and moves the accordion to Generate Copy (same as custom Save & continue). */
  function acceptWritingFramework() {
    saveAndContinue('writingFramework')
  }

  function setFrameworkKind(kind: typeof state.writingFrameworkKind) {
    setState((s) => ({
      ...s,
      writingFrameworkKind: kind,
      ...(kind === 'custom'
        ? {
            writingFrameworkUrn: '',
            writingFrameworkFrameworkMd: '',
            writingFrameworkPostText: '',
          }
        : null),
    }))
  }

  return (
    <div className="cm-workflow">
      <AccordionSection
        title="Writer's Voice"
        subtitle={optionLabel(state.writerVoiceId, WRITER_VOICE_OPTIONS)}
        status={getSummaryStatus('writerVoice', state)}
        isOpen={openSection === 'writerVoice'}
        onToggle={() => toggleOpenSection('writerVoice')}
      >
        <SelectField
          id="writer-voice"
          label="Voice"
          value={state.writerVoiceId}
          onChange={(v) => void loadWriterVoice(v as WriterVoiceId)}
          options={WRITER_VOICE_OPTIONS}
          placeholderOption="Select voice..."
          trailingAccessory={
            <GearEditButton label="Edit writer voice text" onClick={() => setContextModal('writerVoice')} />
          }
        />
      </AccordionSection>

      <AccordionSection
        title="Style Guide"
        subtitle="vantum_style_guide.md"
        status={getSummaryStatus('styleGuide', state)}
        isOpen={openSection === 'styleGuide'}
        onToggle={() => toggleOpenSection('styleGuide')}
      >
        <div className="cm-field">
          {/* Label + gear share one row (same baseline as Voice/Persona label + trailing control). */}
          <div className="cm-field__label-row">
            <label className="cm-label">Style guide</label>
            <GearEditButton label="Edit style guide text" onClick={() => setContextModal('styleGuide')} />
          </div>
        </div>
      </AccordionSection>

      <AccordionSection
        title="Customer Persona"
        subtitle={optionLabel(state.customerPersonaId, PERSONA_OPTIONS)}
        status={getSummaryStatus('customerPersona', state)}
        isOpen={openSection === 'customerPersona'}
        onToggle={() => toggleOpenSection('customerPersona')}
      >
        <SelectField
          id="persona"
          label="Persona"
          value={state.customerPersonaId}
          onChange={(v) => void loadCustomerPersona(v as CustomerPersonaId)}
          options={PERSONA_OPTIONS}
          placeholderOption="Select persona..."
          trailingAccessory={
            <GearEditButton label="Edit customer persona text" onClick={() => setContextModal('customerPersona')} />
          }
        />
      </AccordionSection>

      <AccordionSection
        title="Topic"
        subtitle={topicSubtitle()}
        status={getSummaryStatus('topic', state)}
        isOpen={openSection === 'topic'}
        onToggle={() => toggleOpenSection('topic')}
        highlight={!topicComplete}
        footer={
          <button type="button" className="cm-btn cm-btn--primary" onClick={() => saveAndContinue('topic')}>
            Save &amp; Continue
          </button>
        }
      >
        <TextAreaField
          id="topic-desc"
          label="Post topic"
          rows={5}
          value={state.topic.description}
          onChange={(v) => setState((s) => ({ ...s, topic: { description: v } }))}
          placeholder="Example: Help fractional CMOs turn vague positioning into outcome-driven offers."
          labelTrailing={
            <div className="cm-topic-tools">
              <button
                type="button"
                className="cm-btn cm-btn--small cm-btn--ghost"
                onClick={() => applyRandomTopicToField()}
              >
                Generate
              </button>
              <div className="cm-topic-tools__gear-wrap" ref={topicToolsRef}>
                <GearEditButton
                  label="Edit angle library (JSON)"
                  onClick={() => setTopicToolsOpen((o) => !o)}
                />
                {topicToolsOpen ? (
                  <div className="cm-topic-popover" role="dialog" aria-label="Angle library">
                    <div className="cm-topic-popover__head">
                      <span className="cm-topic-popover__title">Angle library</span>
                    </div>
                    <label className="cm-sr-only" htmlFor="topic-angle-json">
                      Angle presets JSON
                    </label>
                    <textarea
                      id="topic-angle-json"
                      className="cm-textarea cm-topic-popover__json"
                      spellCheck={false}
                      value={draftJson}
                      onChange={(e) => setDraftJson(e.target.value)}
                      rows={14}
                      aria-describedby={saveError ? 'topic-angle-json-err' : undefined}
                    />
                    {saveError ? (
                      <p id="topic-angle-json-err" className="cm-note cm-note--error" role="alert">
                        {saveError}
                      </p>
                    ) : null}
                    <div className="cm-topic-popover__actions">
                      <button
                        type="button"
                        className="cm-btn cm-btn--small cm-btn--primary"
                        onClick={() => {
                          saveDraft()
                        }}
                      >
                        Save library
                      </button>
                      <button type="button" className="cm-btn cm-btn--small" onClick={() => resetToDefaults()}>
                        Reset to defaults
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          }
        />
      </AccordionSection>

      <AccordionSection
        title="Writing Framework"
        subtitle={frameworkSubtitle()}
        status={getSummaryStatus('writingFramework', state)}
        isOpen={openSection === 'writingFramework'}
        onToggle={() => toggleOpenSection('writingFramework')}
        footer={
          state.writingFrameworkKind === 'custom' ? (
            <button
              type="button"
              className="cm-btn cm-btn--primary"
              onClick={() => saveAndContinue('writingFramework')}
            >
              Save &amp; Continue
            </button>
          ) : (
            <button
              type="button"
              className="cm-btn cm-btn--primary"
              disabled={!writingFrameworkSelectionReady(state)}
              onClick={() => acceptWritingFramework()}
            >
              Accept &amp; continue
            </button>
          )
        }
      >
        <div className="cm-field cm-mode-field">
          <span className="cm-label">Source</span>
          <div className="cm-segmented" role="radiogroup" aria-label="Writing framework source">
            <label className="cm-segment">
              <input
                type="radio"
                name="fw-kind"
                checked={state.writingFrameworkKind === 'framework'}
                onChange={() => setFrameworkKind('framework')}
              />
              Framework
            </label>
            <label className="cm-segment">
              <input
                type="radio"
                name="fw-kind"
                checked={state.writingFrameworkKind === 'copy_examples'}
                onChange={() => setFrameworkKind('copy_examples')}
              />
              Copy pattern
            </label>
            <label className="cm-segment">
              <input
                type="radio"
                name="fw-kind"
                checked={state.writingFrameworkKind === 'custom'}
                onChange={() => setFrameworkKind('custom')}
              />
              Custom
            </label>
          </div>
        </div>

        {state.writingFrameworkKind === 'custom' ? (
          <TextAreaField
            id="custom-fw"
            label="Custom framework"
            rows={5}
            value={state.writingFrameworkCustom}
            onChange={(v) => setState((s) => ({ ...s, writingFrameworkCustom: v }))}
            placeholder="Describe the structure you want: hook, beats, CTA placement, tension, pacing."
          />
        ) : (
          <>
            <p className="cm-note">
              Search cached outlier posts by creator, hook, format, structural tags, or performance axis.
              Framework mode only enables rows with cached extraction. Pick a row to preview it, then{' '}
              <strong>Accept &amp; continue</strong> — or open <strong>Generate Copy</strong> to use your last
              selection without accepting (the framework step collapses).
            </p>
            <OutlierCatalogPicker
              entries={cat.entries}
              loading={cat.loadState === 'loading'}
              errorMessage={cat.errorMessage}
              onRefresh={() => void cat.refresh()}
              requireFramework={state.writingFrameworkKind === 'framework'}
              selectedUrn={state.writingFrameworkUrn}
              onSelect={applyWritingPick}
            />
          </>
        )}
      </AccordionSection>

      <AccordionSection
        title="Generate Copy"
        subtitle={generateSubtitle()}
        status={getSummaryStatus('generateCopy', state)}
        isOpen={openSection === 'generateCopy'}
        onToggle={() => toggleOpenSection('generateCopy')}
        highlight={copyReady}
      >
        {copyErrors.length > 0 && (
          <div className="cm-errors" role="alert">
            {copyErrors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}
        <div className="cm-inline-actions">
          <button type="button" className="cm-btn cm-btn--primary" disabled={generating} onClick={runGenerateCopy}>
            {generating ? 'Generating...' : 'Generate Copy'}
          </button>
        </div>
        {genCount === 0 ? (
          <p className="cm-muted">
            {copyReady
              ? 'Ready. Generate a post, then use Regenerate to add more versions. Use the arrows to move between them.'
              : 'Complete topic and framework, then generate your first post.'}
          </p>
        ) : (
          <div className="cm-copy-view">
            <div className="cm-copy-view__nav" aria-label="Generation history">
              <button
                type="button"
                className="cm-btn cm-copy-view__chev"
                disabled={!canGoPrevGen}
                aria-label="Previous generation"
                onClick={goPrevGeneration}
              >
                ‹
              </button>
              <span className="cm-copy-view__counter">
                {genSafeIdx + 1} / {genCount}
              </span>
              <button
                type="button"
                className="cm-btn cm-copy-view__chev"
                disabled={!canGoNextGen}
                aria-label="Next generation"
                onClick={goNextGeneration}
              >
                ›
              </button>
            </div>
            <pre className="cm-post-card__body cm-copy-view__body">{currentGeneratedBody}</pre>
            <div className="cm-inline-actions">
              <button
                type="button"
                className="cm-btn cm-btn--primary"
                disabled={generating || !currentGeneratedBody.trim()}
                onClick={() => selectGeneratedPost(currentGeneratedBody)}
              >
                Use this
              </button>
              <button type="button" className="cm-btn" disabled={generating} onClick={() => void regenerateCopy()}>
                {generating ? 'Generating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        )}
      </AccordionSection>

      <AccordionSection
        title="Final Post"
        subtitle={finalSubtitle()}
        status={getSummaryStatus('finalPost', state)}
        isOpen={openSection === 'finalPost'}
        onToggle={() => toggleOpenSection('finalPost')}
      >
        <FinalPostEditor
          value={state.selectedPost}
          locked={!state.hasChosenFinalPost}
          onChange={(v) => setState((s) => ({ ...s, selectedPost: v, finalPostSaved: false }))}
          onSaveFinal={saveFinal}
          onGenerateImage={() => {
            if (!state.selectedPost.trim()) return
            openImageSection()
          }}
        />
      </AccordionSection>

      <AccordionSection
        title="Image"
        subtitle={imageSubtitle()}
        status={getSummaryStatus('imageGen', state)}
        isOpen={openSection === 'imageGen'}
        onToggle={() => toggleOpenSection('imageGen')}
      >
        <ImageGenerationPanel
          locked={!state.selectedPost.trim()}
          imageContext={state.imageContext}
          onImageContext={(v) => setState((s) => ({ ...s, imageContext: v }))}
          referenceImages={state.referenceImages}
          onAddImages={(items) => setState((s) => ({ ...s, referenceImages: [...s.referenceImages, ...items] }))}
          onRemoveImage={(_name, previewUrl) =>
            setState((s) => {
              URL.revokeObjectURL(previewUrl)
              return {
                ...s,
                referenceImages: s.referenceImages.filter((i) => i.previewUrl !== previewUrl),
              }
            })
          }
          generatedImageUrl={state.generatedImageUrl}
          loading={imageLoading}
          imageGenError={state.imageGenError}
          onGenerate={() => void runNanoBanana()}
          onRegenerate={(append) => void runNanoBanana(append)}
          onDownload={downloadImage}
          onStartNew={startNewPost}
        />
      </AccordionSection>

      {contextModal != null && (
        <EditContextModal
          key={contextModal}
          title={
            contextModal === 'writerVoice'
              ? 'Edit writer voice'
              : contextModal === 'styleGuide'
                ? 'Edit style guide'
                : 'Edit customer persona'
          }
          open
          initialText={
            contextModal === 'writerVoice'
              ? state.writerVoiceContent
              : contextModal === 'styleGuide'
                ? state.styleGuide
                : state.customerPersonaContent
          }
          onClose={() => setContextModal(null)}
          onSave={(text) => {
            const k = contextModal
            setState((s) =>
              k === 'writerVoice'
                ? { ...s, writerVoiceContent: text }
                : k === 'styleGuide'
                  ? { ...s, styleGuide: text }
                  : { ...s, customerPersonaContent: text },
            )
          }}
        />
      )}
    </div>
  )
}
