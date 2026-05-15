type Props = {
  id: string
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  readOnly?: boolean
}

/**
 * Labeled textarea with consistent spacing for the workflow forms.
 */
export function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  disabled,
  readOnly,
}: Props) {
  return (
    <div className="cm-field">
      <label className="cm-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={`cm-textarea ${readOnly ? 'cm-textarea--readonly' : ''}`.trim()}
        rows={rows}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  )
}
