import { differenceInCalendarDays, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
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
 * What the athlete records (words, body zones, intensity, notes) is never read here.
 * Nothing is collected or sent until setUsageConsent(true) has been called.
 */

export type UsageEvent = {
  v: 1
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
}

type State = {
  consent: boolean
  firstDay: string | null
  lastDay: string | null
  lastWeek: string | null
  lastLifeWeek: number | null
  lastHiddenAt: number | null
  queue: UsageEvent[]
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

export const getUsageConsent = (): boolean => loadState().consent

/** Turning consent off also wipes every counter and unsent row kept on the device. */
export const setUsageConsent = (consent: boolean): void => {
  saveState(consent ? { ...loadState(), consent: true } : emptyState())
}

type Options = {
  endpoint?: string
  now?: () => number
  send?: (endpoint: string, events: UsageEvent[]) => Promise<boolean>
  doc?: Document
}

const defaultSend = async (endpoint: string, events: UsageEvent[]): Promise<boolean> => {
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
  now = Date.now,
  send = defaultSend,
  doc = document,
}: Options = {}): (() => void) => {
  if (!endpoint) return () => {}

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
    const state = loadState()
    if (!state.consent) return
    if (duration < MIN_VISIT_MS && !continued) return

    const date = new Date(endedAt)
    const day = toDateKey(date)
    const week = isoWeekKey(date)
    const firstDay = state.firstDay ?? day
    const lifeWeek = Math.floor(differenceInCalendarDays(date, parseISO(firstDay)) / 7)

    const event: UsageEvent = {
      v: 1,
      day,
      seconds: Math.round(duration / 10_000) * 10,
      cohort_week: isoWeekKey(parseISO(firstDay)),
      week_since_first: lifeWeek,
      first_ever: !continued && state.firstDay === null,
      first_of_day: !continued && state.lastDay !== day,
      first_of_week: !continued && state.lastWeek !== week,
      first_of_life_week: !continued && state.lastLifeWeek !== lifeWeek,
      continued,
    }

    saveState({
      ...state,
      firstDay,
      lastDay: day,
      lastWeek: week,
      lastLifeWeek: lifeWeek,
      lastHiddenAt: endedAt,
      queue: [...state.queue, event].slice(-MAX_QUEUE),
    })
    void flush()
  }

  const startVisit = () => {
    if (visibleSince !== null) return
    const startedAt = now()
    const { lastHiddenAt } = loadState()
    continued = lastHiddenAt !== null && startedAt - lastHiddenAt < RESUME_WINDOW_MS
    visibleSince = startedAt
    void flush() // rows that could not be sent last time (offline)
  }

  const onVisibility = () => (doc.visibilityState === 'visible' ? startVisit() : endVisit())
  const onPageHide = () => endVisit()

  doc.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  if (visibleSince !== null) void flush()

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
  }
}
