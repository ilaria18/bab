import type { ReactNode } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes/paths'
import './TabBar.css'

const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const HomeIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9h12v-9" />
  </svg>
)

const CalendarIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="4" y="5.5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8 3.5v3M16 3.5v3" />
  </svg>
)

const SettingsIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3H9.8l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.07-.4.1-.8.1-1.2Z" />
  </svg>
)

const WorldIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
)

const FeedbackIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />
    <path d="M8 10h8M8 13h5" />
  </svg>
)

const TABS: { to: string; label: MessageDescriptor; icon: () => ReactNode }[] = [
  { to: ROUTES.checkIn, label: msg`Home`, icon: HomeIcon },
  { to: ROUTES.calendar, label: msg`Journal`, icon: CalendarIcon },
  { to: ROUTES.world, label: msg`World`, icon: WorldIcon },
  // always one tap away: anonymous feedback to the BAB team
  { to: ROUTES.feedback, label: msg`Feedback`, icon: FeedbackIcon },
  { to: ROUTES.settings, label: msg`Settings`, icon: SettingsIcon },
]

export const TabBar = () => {
  const { t, i18n } = useLingui()
  return (
    <nav className="tab-bar" aria-label={t`Primary`}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) => `tab-bar-item${isActive ? ' tab-bar-item-active' : ''}`}
        >
          <span className="tab-bar-icon" aria-hidden="true">
            {tab.icon()}
          </span>
          <span className="tab-bar-label">{i18n._(tab.label)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
