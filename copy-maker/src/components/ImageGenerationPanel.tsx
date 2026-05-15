import type { ReferenceImageItem } from '../types/copyMaker'
import { TextAreaField } from './TextAreaField'
import { ReferenceImageUploader } from './ReferenceImageUploader'

type Props = {
  locked: boolean
  imageContext: string
  onImageContext: (v: string) => void
  referenceImages: ReferenceImageItem[]
  onAddImages: (items: ReferenceImageItem[]) => void
  onRemoveImage: (name: string, previewUrl: string) => void
  generatedImageUrl: string
  loading: boolean
  /** Shown when the Gemini / Nano Banana call fails (missing key, quota, blocked prompt, etc.). */
  imageGenError: string
  onGenerate: () => void
  onRegenerate: () => void
  onDownload: () => void
  onStartNew: () => void
}

/**
 * Nano Banana panel: context, uploads, generate + preview actions.
 */
export function ImageGenerationPanel({
  locked,
  imageContext,
  onImageContext,
  referenceImages,
  onAddImages,
  onRemoveImage,
  generatedImageUrl,
  loading,
  imageGenError,
  onGenerate,
  onRegenerate,
  onDownload,
  onStartNew,
}: Props) {
  return (
    <div className="cm-stack">
      {locked ? (
        <p className="cm-muted">Save a final post before generating an image.</p>
      ) : (
        <>
          <TextAreaField
            id="image-context"
            label="Additional image context"
            rows={4}
            value={imageContext}
            onChange={onImageContext}
            placeholder="Mood, scene, metaphor, visual style, what to avoid."
          />
          <ReferenceImageUploader
            images={referenceImages}
            onAdd={onAddImages}
            onRemove={onRemoveImage}
            disabled={loading}
          />
          <div className="cm-inline-actions">
            <button type="button" className="cm-btn cm-btn--primary" disabled={loading} onClick={onGenerate}>
              Generate Image with Nano Banana
            </button>
          </div>
          {imageGenError.trim() ? (
            <p className="cm-note cm-note--error" role="alert">
              {imageGenError}
            </p>
          ) : null}
        </>
      )}
      {loading && <p className="cm-muted">Generating image…</p>}
      <div className="cm-image-frame">
        {!generatedImageUrl ? (
          <div className="cm-image-placeholder">Your generated image will appear here.</div>
        ) : (
          <img src={generatedImageUrl} alt="Generated visual" className="cm-image-preview" />
        )}
      </div>
      {generatedImageUrl && !loading && (
        <div className="cm-inline-actions">
          <button type="button" className="cm-btn" onClick={onRegenerate}>
            Regenerate Image
          </button>
          <button type="button" className="cm-btn" onClick={onDownload}>
            Download Image
          </button>
          <button type="button" className="cm-btn" onClick={onStartNew}>
            Start New Post
          </button>
        </div>
      )}
    </div>
  )
}
