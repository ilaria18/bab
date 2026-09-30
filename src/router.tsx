import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { ROUTES } from '@/routes/paths'
import { PageFrame } from '@/shared/layout'
import { ErrorPage } from './features/error/ErrorPage'

const loadBodyWordCards = () => import('./features/word-field/BodyWordCards')
const loadCheckIn = () => import('./features/check-in/CheckIn').then((m) => ({ default: m.CheckIn }))
const loadCheckInFlowPage = () =>
  import('./features/check-in-flow/CheckInFlowPage').then((m) => ({ default: m.CheckInFlowPage }))
const loadCalendarPage = () =>
  import('./features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage }))
const loadAvatarPage = () =>
  import('./features/avatar/AvatarPage').then((m) => ({ default: m.AvatarPage }))
const loadFeedbackPage = () =>
  import('./features/feedback/FeedbackPage').then((m) => ({ default: m.FeedbackPage }))
const loadSettingsPage = () =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))

const BodyWordCards = lazy(loadBodyWordCards)
const CheckIn = lazy(loadCheckIn)
const CheckInFlowPage = lazy(loadCheckInFlowPage)
const CalendarPage = lazy(loadCalendarPage)
const AvatarPage = lazy(loadAvatarPage)
const SettingsPage = lazy(loadSettingsPage)
const FeedbackPage = lazy(loadFeedbackPage)

/** Downloads every route's chunk in the background so a first visit to a page opens
 * instantly instead of waiting on the network. Failures are ignored: the route just
 * loads on demand as before. */
export const preloadRoutes = (): void => {
  ;[loadCheckIn, loadBodyWordCards, loadCalendarPage, loadAvatarPage, loadSettingsPage, loadCheckInFlowPage, loadFeedbackPage].forEach(
    (load) => load().catch(() => {}),
  )
}

// Keeps the shared page shell in place while a route's chunk loads, instead
// of flashing to a blank screen between routes.
const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<PageFrame>{null}</PageFrame>}>{element}</Suspense>
)

// Imported statically (not lazy): it must render even when a route chunk fails to load.
const errorElement = <ErrorPage />

export const router = createBrowserRouter([
  { path: ROUTES.checkIn, element: withSuspense(<CheckIn />), errorElement },
  { path: ROUTES.words, element: withSuspense(<BodyWordCards />), errorElement },
  { path: ROUTES.checkInFlow, element: withSuspense(<CheckInFlowPage />), errorElement },
  { path: ROUTES.calendar, element: withSuspense(<CalendarPage />), errorElement },
  { path: ROUTES.settings, element: withSuspense(<SettingsPage />), errorElement },
  { path: ROUTES.world, element: withSuspense(<AvatarPage />), errorElement },
  { path: ROUTES.feedback, element: withSuspense(<FeedbackPage />), errorElement },
])
