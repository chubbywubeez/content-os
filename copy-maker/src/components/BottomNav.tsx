export type NavId = 'content-os' | 'interviews' | 'demos' | 'prompts'

type Props = {
  active: NavId
  onChange: (id: NavId) => void
}

const ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: 'content-os', label: 'Content OS', icon: '▦' },
  { id: 'interviews', label: 'Interviews', icon: '◎' },
  { id: 'demos', label: 'Demos', icon: '▶' },
  { id: 'prompts', label: 'Prompts', icon: '✎' },
]

/**
 * Fixed bottom capsule nav — Content OS, Interviews, Demos, Prompts.
 */
export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="cm-bottom-nav" aria-label="Main">
      <div className="cm-bottom-nav__track cm-bottom-nav__track--4">
        {ITEMS.map((item) => {
          const isActive = item.id === active
          return (
            <button
              key={item.id}
              type="button"
              className={`cm-bottom-nav__item ${isActive ? 'cm-bottom-nav__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(item.id)}
            >
              {isActive ? <span className="cm-bottom-nav__indicator" aria-hidden /> : null}
              <span className="cm-bottom-nav__icon" aria-hidden>
                {item.icon}
              </span>
              <span className="cm-bottom-nav__label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
