import type { SectionStatus } from '../types/copyMaker'

type Props = {
  status: SectionStatus
  /** When true, completed state reads "Generated" in parent via summaryLabel. */
  className?: string
}

/**
 * Small pill showing Empty / Draft / Complete for accordions + summary rail.
 */
export function StatusBadge({ status, className = '' }: Props) {
  const label = status === 'empty' ? 'Empty' : status === 'draft' ? 'Draft' : 'Complete'
  return (
    <span className={`cm-status cm-status--${status} ${className}`.trim()} aria-label={`Status: ${label}`}>
      {label}
    </span>
  )
}
