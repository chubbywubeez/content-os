export type NavId =
  | 'content-os'
  | 'interviews'
  | 'demos'
  | 'prompts'
  | 'resources'

type Props = {
  active: NavId
  onChange: (id: NavId) => void
}

const ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: 'content-os', label: 'Content OS', icon: '▤' },
  { id: 'interviews', label: 'Interviews', icon: '◉' },
  { id: 'demos', label: 'Demos', icon: '▷' },
  { id: 'prompts', label: 'Prompts', icon: '✎' },
  { id: 'resources', label: 'Resources', icon: '⌘' },
]

/**
 * Floating bottom dock:
 * - icon-first chips with hover labels
 * - emerald active chip + notch marker
 * - same routes and page names as before
 */
export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="cm-bottom-nav" aria-label="Main">
      <div className="cm-bottom-nav__track">
        {ITEMS.map((item) => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              type="button"
              className={`cm-bottom-nav__item ${isActive ? 'cm-bottom-nav__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => onChange(item.id)}
            >
              <span className="cm-bottom-nav__tooltip" aria-hidden>
                {item.label}
              </span>
              {isActive ? <span className="cm-bottom-nav__indicator" aria-hidden /> : null}
              <span className="cm-bottom-nav__chip">
                <span className="cm-bottom-nav__icon" aria-hidden>
                  {item.icon}
                </span>
              </span>
              <span className="cm-sr-only">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
