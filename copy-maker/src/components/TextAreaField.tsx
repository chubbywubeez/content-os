import type { ReactNode } from 'react'

type Props = {
  id: string
  label: string
  value: string
  onChange?: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  readOnly?: boolean
  /** Renders on the same row as the label (e.g. Generate + gear for Post topic). */
  labelTrailing?: ReactNode
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
  labelTrailing,
}: Props) {
  return (
    <div className="cm-field">
      {labelTrailing ? (
        <div className="cm-field__label-row">
          <label className="cm-label" htmlFor={id}>
            {label}
          </label>
          <div className="cm-field__label-trail">{labelTrailing}</div>
        </div>
      ) : (
        <label className="cm-label" htmlFor={id}>
          {label}
        </label>
      )}
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
