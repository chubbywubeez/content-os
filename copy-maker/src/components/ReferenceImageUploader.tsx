import type { ReferenceImageItem } from '../types/copyMaker'

type Props = {
  images: ReferenceImageItem[]
  onAdd: (items: ReferenceImageItem[]) => void
  onRemove: (name: string, previewUrl: string) => void
  disabled?: boolean
}

/**
 * Multi-image upload with FileReader → base64 + object URL previews.
 * Revokes object URLs on remove to avoid leaking memory.
 */
export function ReferenceImageUploader({ images, onAdd, onRemove, disabled }: Props) {
  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    const next: ReferenceImageItem[] = []
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith('image/')) continue
      const dataUrl = await readFileAsDataUrl(file)
      const comma = dataUrl.indexOf(',')
      const header = dataUrl.slice(0, comma)
      const base64 = dataUrl.slice(comma + 1)
      const mimeMatch = /^data:(.*?);base64$/i.exec(header)
      const mimeType = mimeMatch?.[1] || file.type || 'application/octet-stream'
      next.push({
        base64,
        mimeType,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (next.length) onAdd(next)
  }

  return (
    <div className="cm-field">
      <div className="cm-label">Reference images</div>
      <p className="cm-note">Optional. Thumbnails are previews; base64 is stored for the Nano Banana payload.</p>
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {images.length > 0 && (
        <ul className="cm-thumb-grid">
          {images.map((img) => (
            <li key={`${img.name}-${img.previewUrl}`} className="cm-thumb">
              <img src={img.previewUrl} alt={img.name} />
              <button
                type="button"
                className="cm-thumb__x"
                disabled={disabled}
                onClick={() => {
                  URL.revokeObjectURL(img.previewUrl)
                  onRemove(img.name, img.previewUrl)
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
