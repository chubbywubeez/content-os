import type { CopyModelId, ImageModelId } from '../config/modelProviders'
import { COPY_MODEL_OPTIONS, IMAGE_MODEL_OPTIONS } from '../config/modelProviders'

type Props = {
  copyModelId: CopyModelId
  imageModelId: ImageModelId
  onCopyModelChange: (id: CopyModelId) => void
  onImageModelChange: (id: ImageModelId) => void
}

/**
 * Top bar: product name plus Copy Model / Image Model rows (label left, bordered select right).
 */
export function CopyMakerHeader({ copyModelId, imageModelId, onCopyModelChange, onImageModelChange }: Props) {
  return (
    <header className="cm-header">
      <div className="cm-header__brand">
        <h1 className="cm-header__title">Content OS</h1>
      </div>
      <div className="cm-header__actions">
        <div className="cm-header__model-controls" role="group" aria-label="Copy and image models">
          <div className="cm-header__model-row">
            <label className="cm-header__model-label" htmlFor="cm-header-copy-model">
              Copy Model
            </label>
            <select
              id="cm-header-copy-model"
              className="cm-header-select"
              value={copyModelId}
              onChange={(e) => onCopyModelChange(e.target.value as CopyModelId)}
              aria-label="Copy generation model"
            >
              {COPY_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cm-header__model-row">
            <label className="cm-header__model-label" htmlFor="cm-header-image-model">
              Image Model
            </label>
            <select
              id="cm-header-image-model"
              className="cm-header-select"
              value={imageModelId}
              onChange={(e) => onImageModelChange(e.target.value as ImageModelId)}
              aria-label="Image generation model"
            >
              {IMAGE_MODEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  )
}
