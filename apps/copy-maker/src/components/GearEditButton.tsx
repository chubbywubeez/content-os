type Props = {
  /** Shown to screen readers only (e.g. "Edit voice content"). */
  label: string
  onClick: () => void
  disabled?: boolean
}

/** Compact settings-style control to open the context edit modal. */
export function GearEditButton({ label, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      className="cm-gear-btn"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="cm-gear-btn__icon" aria-hidden="true">
        &#x2699;&#xfe0f;
      </span>
    </button>
  )
}
