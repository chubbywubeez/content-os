import type { ReactNode } from 'react'

type Option = { value: string; label: string }

type Props = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: Option[]
  placeholderOption?: string
  disabled?: boolean
  /** Renders to the right of the dropdown (e.g. gear to open an edit modal). */
  trailingAccessory?: ReactNode
}

/**
 * Native select styled to match the rest of the form controls.
 */
export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholderOption = 'Select…',
  disabled,
  trailingAccessory,
}: Props) {
  return (
    <div className="cm-field">
      <label className="cm-label" htmlFor={id}>
        {label}
      </label>
      {trailingAccessory ? (
        <div className="cm-field__select-row">
          <select
            id={id}
            className="cm-select cm-select--with-trail"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{placeholderOption}</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {trailingAccessory}
        </div>
      ) : (
        <select
          id={id}
          className="cm-select"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholderOption}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
