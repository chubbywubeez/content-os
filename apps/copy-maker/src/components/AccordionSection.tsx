import type { ReactNode } from 'react'
import type { SectionStatus } from '../types/copyMaker'
import { StatusBadge } from './StatusBadge'

type Props = {
  title: string
  /** Short selection summary (e.g. current voice). Omit for no second line. */
  subtitle?: string
  status: SectionStatus
  isOpen: boolean
  onToggle: () => void
  /** When true, subtle highlight for the Generate Copy step after topic is ready. */
  highlight?: boolean
  disabled?: boolean
  children?: ReactNode
  footer?: ReactNode
}

/**
 * Accordion shell: header row with chevron + optional body/footer slots.
 */
export function AccordionSection({
  title,
  subtitle,
  status,
  isOpen,
  onToggle,
  highlight,
  disabled,
  children,
  footer,
}: Props) {
  const sub = subtitle?.trim()
  return (
    <section
      className={`cm-accordion ${isOpen ? 'cm-accordion--open' : ''} ${highlight ? 'cm-accordion--hi' : ''}`.trim()}
    >
      <button
        type="button"
        className="cm-accordion__head"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${title}`}
      >
        <div className="cm-accordion__head-main">
          <StatusBadge status={status} />
          <div className="cm-accordion__titles">
            {sub ? (
              <div className="cm-accordion__title-line">
                <span className="cm-accordion__title">{title}:</span>
                <span className="cm-accordion__subtitle">{sub}</span>
              </div>
            ) : (
              <div className="cm-accordion__title">{title}</div>
            )}
          </div>
        </div>
        <span className="cm-chevron" aria-hidden>
          {isOpen ? '▾' : '▸'}
        </span>
      </button>
      {isOpen && (
        <div className="cm-accordion__body">
          {children}
          {footer && <div className="cm-accordion__footer">{footer}</div>}
        </div>
      )}
    </section>
  )
}
