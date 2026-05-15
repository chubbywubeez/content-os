type Props = {
  value: string
  onChange: (v: string) => void
  locked: boolean
  onSaveFinal: () => void
  onGenerateImage: () => void
}

/**
 * Final editable post area. Stays empty until a generated card is chosen.
 */
export function FinalPostEditor({ value, onChange, locked, onSaveFinal, onGenerateImage }: Props) {
  return (
    <div className="cm-field">
      <label className="cm-label" htmlFor="final-post">
        Final post
      </label>
      {locked ? (
        <p className="cm-muted">Choose a generated post to start editing.</p>
      ) : (
        <textarea
          id="final-post"
          className="cm-textarea"
          rows={12}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your selected post appears here. Edit freely."
        />
      )}
      <div className="cm-inline-actions">
        <button type="button" className="cm-btn" disabled={locked || !value.trim()} onClick={onSaveFinal}>
          Save Final Post
        </button>
        <button
          type="button"
          className="cm-btn cm-btn--primary"
          disabled={locked || !value.trim()}
          onClick={onGenerateImage}
        >
          Generate Image
        </button>
      </div>
    </div>
  )
}
