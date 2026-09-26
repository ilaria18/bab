import { App } from '@capacitor/app'
import { differenceInCalendarDays, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import { appPlatform, isInstalledWebApp, isNativeApp, type AppPlatform } from '@/shared/lib/platform'
import { toDateKey } from '@/shared/lib/dateKey'
import { safeStorage } from '@/shared/lib/safeStorage'

/**
 * Anonymous usage statistics.
 *
 * Every time the app goes to the background, one row describing that visit is sent to
 * VITE_USAGE_ENDPOINT. A row carries no identifier of any kind — no user id, no device id,
 * no clock time — only the calendar day, how long the app stayed open and a few yes/no flags
 * ("first visit today", "first visit this week", ...). Counting the flags on the server gives
 * daily/weekly active users and weekly retention without ever being able to link two rows to
 * the same person.
 *
 * Once a week the phone also sends one summary row: in how many days (as a band: 1-2, 3-4, 5-7)
 * the app was used the week before. That shows how use is spread across the team ("4 athletes
 * almost daily, 6 twice a week") without following anyone.
 *
 * What the athlete records (words, body zones, intensity, notes) is never read here — only how
 * many check-ins were completed during a visit.
 * Nothing is collected or sent until setUsageConsent(true) has been called.
 *
 * Only the app counts: the native app, or the website opened from its icon on a phone's home
 * screen. The website in a browser tab, or on a computer, is never measured (see usageStatsCounted).
 */

export type UsageEvent = {
  v: 3
  /** local calendar day of the visit, YYYY-MM-DD */
  day: string
  /** time the app was in the foreground, rounded to 10 s */
  seconds: number
  /** ISO week of the device's first visit, e.g. 2026-W39 — groups devices into cohorts */
  cohort_week: string
  /** whole weeks since the device's first visit: 0 for days 0-6, 1 for days 7-13, ... */
  week_since_first: number
  first_ever: boolean
  first_of_day: boolean
  /** first visit in this calendar (ISO) week */
  first_of_week: boolean
  /** first visit in this week_since_first */
  first_of_life_week: boolean
  /** the app came back within RESUME_WINDOW_MS: extra time for the previous visit, not a new opening */
  continued: boolean
  /** ios / android app, or web — to compare the two halves of a team */
  platform: AppPlatform
  /** check-ins completed during this visit (how many, never what) */
  checkins: number
  /** the app was opened by tapping the daily reminder */
  from_reminder: boolean
  /** the daily reminder is switched on and the phone allows notifications */
  reminder_on: boolean
}

export type ActiveDaysBand = '1-2' | '3-4' | '5-7'

/** Sent once, at the first visit of a new week, about the last week the app was used. */
export type WeekSummary = {
  v: 3
  kind: 'week'
  /** ISO week the summary is about, e.g. 2026-W40 */
  week: string
  /** in how many different days of that week the app was used */
  active_days: ActiveDaysBand
  platform: AppPlatform
}

export type UsageRow = UsageEvent | WeekSummary

type State = {
  consent: boolean
  firstDay: string | null
  lastDay: string | null
  lastWeek: string | null
  lastLifeWeek: number | null
  lastHiddenAt: number | null
  /** calendar week being counted for the weekly summary, and the days of it with a visit */
  activeWeek: string | null
  activeDays: string[]
  queue: UsageRow[]
}

const STORAGE_KEY = 'bab.usage-stats.v1'
/** coming back within this long (e.g. after a quick look at another app) is the same visit */
export const RESUME_WINDOW_MS = 30_000
/** visits shorter than this are dropped: the app was opened by mistake */
export const MIN_VISIT_MS = 2_000
const MAX_QUEUE = 300

const emptyState = (): State => ({
  consent: false,
  firstDay: null,
  lastDay: null,
  lastWeek: null,
  lastLifeWeek: null,
  lastHiddenAt: null,
  activeWeek: null,
  activeDays: [],
  queue: [],
})

const loadState = (): State => {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY)
    return raw ? { ...emptyState(), ...(JSON.parse(raw) as Partial<State>) } : emptyState()
  } catch {
    return emptyState()
  }
}

const saveState = (state: State) => safeStorage.setItem(STORAGE_KEY, JSON.stringify(state))

export const isoWeekKey = (date: Date): string =>
  `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`

export const activeDaysBand = (days: number): ActiveDaysBand => (days <= 2 ? '1-2' : days <= 4 ? '3-4' : '5-7')

export const getUsageConsent = (): boolean => loadState().consent

/**
 * Whether this copy of BAB is measured: the native app, or the website installed on a phone's home
 * screen. Visits in a browser tab (someone looking at the site before installing it) and on a
 * computer are left out, so the pilot counts only real use of the app.
 */
export const usageStatsCounted = (
  native = isNativeApp(),
  installed?: boolean,
  platform?: AppPlatform,
): boolean => native || ((installed ?? isInstalledWebApp()) && (platform ?? appPlatform()) !== 'web')

// What happens during the current visit, reported when it ends.
let visitCheckins = 0
let visitFromReminder = false
/** a reminder tap can arrive just before the app reports it is in the foreground */
let pendingFromReminder = false
let reminderOn = false

/** Call when a new check-in has been saved. */
export const recordCheckIn = (): void => {
  visitCheckins += 1
}

/** Call when the app was opened by tapping the daily reminder. */
export const recordOpenedFromReminder = (): void => {
  visitFromReminder = true
  pendingFromReminder = true
}

/** Call whenever the reminder is (re)scheduled or switched off. */
export const recordReminderActive = (active: boolean): void => {
  reminderOn = active
}

/** Turning consent off also wipes every counter and unsent row kept on the device. */
export const setUsageConsent = (consent: boolean): void => {
  saveState(consent ? { ...loadState(), consent: true } : emptyState())
}

type Options = {
  endpoint?: string
  platform?: AppPlatform
  native?: boolean
  /** false in a browser tab or on a computer: nothing is measured (defaults to usageStatsCounted()) */
  counted?: boolean
  now?: () => number
  send?: (endpoint: string, events: UsageRow[]) => Promise<boolean>
  doc?: Document
}

const defaultSend = async (endpoint: string, events: UsageRow[]): Promise<boolean> => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      // text/plain keeps this a "simple" request (no CORS preflight), keepalive lets it
      // finish while the app is being put in the background
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(events),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    return response.ok
  } catch {
    return false
  }
}

/** Starts measuring visits. Returns a function that stops listening (used by tests). */
export const startUsageStats = ({
  endpoint = import.meta.env.VITE_USAGE_ENDPOINT as string | undefined,
  platform = appPlatform(),
  native = isNativeApp(),
  counted = usageStatsCounted(native),
  now = Date.now,
  send = defaultSend,
  doc = document,
}: Options = {}): (() => void) => {
  if (!endpoint || !counted) return () => {}

  let visibleSince: number | null = doc.visibilityState === 'visible' ? now() : null
  let continued = false
  let sending = false

  const flush = async () => {
    const state = loadState()
    if (!state.consent || state.queue.length === 0 || sending) return
    sending = true
    const batch = state.queue.slice(0, 50)
    const ok = await send(endpoint, batch)
    sending = false
    if (!ok) return
    const latest = loadState()
    saveState({ ...latest, queue: latest.queue.slice(batch.length) })
    if (latest.queue.length > batch.length) void flush()
  }

  const endVisit = () => {
    if (visibleSince === null) return
    const endedAt = now()
    const duration = endedAt - visibleSince
    visibleSince = null
    const checkins = visitCheckins
    const fromReminder = visitFromReminder
    visitCheckins = 0
    visitFromReminder = false
    pendingFromReminder = false
    const state = loadState()
    if (!state.consent) return
    if (duration < MIN_VISIT_MS && !continued && checkins === 0) return

    const date = new Date(endedAt)
    const day = toDateKey(date)
    const week = isoWeekKey(date)
    const firstDay = state.firstDay ?? day
    const lifeWeek = Math.floor(differenceInCalendarDays(date, parseISO(firstDay)) / 7)

    const event: UsageEvent = {
      v: 3,
      day,
      seconds: Math.round(duration / 10_000) * 10,
      cohort_week: isoWeekKey(parseISO(firstDay)),
      week_since_first: lifeWeek,
      first_ever: !continued && state.firstDay === null,
      first_of_day: !continued && state.lastDay !== day,
      first_of_week: !continued && state.lastWeek !== week,
      first_of_life_week: !continued && state.lastLifeWeek !== lifeWeek,
      continued,
      platform,
      checkins,
      from_reminder: fromReminder,
      reminder_on: reminderOn,
    }

    // a new week has started: report how many days the previous active week had
    const summaries: WeekSummary[] =
      state.activeWeek !== null && state.activeWeek !== week && state.activeDays.length > 0
        ? [{ v: 3, kind: 'week', week: state.activeWeek, active_days: activeDaysBand(state.activeDays.length), platform }]
        : []
    const activeDays =
      state.activeWeek === week ? Array.from(new Set([...state.activeDays, day])) : [day]

    saveState({
      ...state,
      firstDay,
      lastDay: day,
      lastWeek: week,
      lastLifeWeek: lifeWeek,
      lastHiddenAt: endedAt,
      activeWeek: week,
      activeDays,
      queue: [...state.queue, ...summaries, event].slice(-MAX_QUEUE),
    })
    void flush()
  }

  const startVisit = () => {
    if (visibleSince !== null) return
    const startedAt = now()
    const { lastHiddenAt } = loadState()
    continued = lastHiddenAt !== null && startedAt - lastHiddenAt < RESUME_WINDOW_MS
    visibleSince = startedAt
    visitCheckins = 0
    visitFromReminder = pendingFromReminder
    void flush() // rows that could not be sent last time (offline)
  }

  const onVisibility = () => (doc.visibilityState === 'visible' ? startVisit() : endVisit())
  const onPageHide = () => endVisit()

  doc.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  // In the app the WebView's visibility events are not reliable on every phone: the system's own
  // foreground/background signal is. Both may fire for the same change — startVisit/endVisit
  // ignore the second call.
  const appListener = native
    ? App.addListener('appStateChange', ({ isActive }) => (isActive ? startVisit() : endVisit()))
    : null
  if (visibleSince !== null) void flush()

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    void appListener?.then((handle) => handle.remove())
  }
}
