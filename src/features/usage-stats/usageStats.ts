import { App } from '@capacitor/app'
import { differenceInCalendarDays, getISOWeek, getISOWeekYear, parseISO } from 'date-fns'
import { appPlatform, isInstalledWebApp, isNativeApp, type AppPlatform } from '@/shared/lib/platform'
import { toDateKey } from '@/shared/lib/dateKey'
import { safeStorage } from '@/shared/lib/safeStorage'
import { getTrainingRoutine, type Session } from '@/features/reminder/trainingRoutine'
import { currentTeam, type Team } from '@/shared/lib/team'
import { hadPeriodOn } from '@/entities/daily-log/dailyLogRepository'

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
 * What the athlete records (words, body zones, intensity, notes) is never read here — only how
 * many check-ins were completed during a visit, and how many times My patterns was opened.
 * The one exception is the period day rows (DayRow), off unless VITE_PERIOD_STATS=on.
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
  /** the day has a match or a training in the athlete's weekly routine (Settings), or none */
  session_day: SessionDay
  /** times the My patterns tab was opened during this visit */
  patterns_views: number
  /** the first visit of this ISO week in which My patterns was opened */
  patterns_first_of_week: boolean
  /** the first visit ever in which My patterns was opened */
  patterns_first_ever: boolean
}

export type SessionDay = 'training' | 'match' | 'none'

/**
 * Once a week (with the first visit of the week) the phone also sends the training/match routine
 * the athlete entered in Settings — weekday, kind, start, end — with no identifier, like the visits,
 * and not linked to them: it shows the teams' training load. An empty list = no routine entered.
 */
export type RoutineRow = {
  v: 3
  kind: 'routine'
  /** ISO week, e.g. 2026-W41 */
  week: string
  sessions: Session[]
  platform: AppPlatform
}

/**
 * Period and app use — OFF unless VITE_PERIOD_STATS=on, and only on a team's phones. Whether a day
 * was a period day is health data of a minor: switch it on only once the lawyer, the information
 * notice and the parental consents allow it (and PERIOD_STATS=on on the server, which otherwise
 * throws these rows away).
 *
 * One row per phone and day of use, sent once the day is over (with the first visit of a later
 * day): only the ISO week (not the day), the athlete's own answer to "period today?" (yes / no /
 * not answered), and how much she used the app that day. No identifier, not linked to the visits.
 */
export type DayRow = {
  v: 3
  kind: 'day'
  week: string
  on_period: boolean | null
  /** openings that day (quick returns are not new openings) */
  visits: number
  seconds: number
  checkins: number
  platform: AppPlatform
}

/** what goes to the server: visit rows, the weekly routine row and (if on) the period day rows */
export type UsageRow = UsageEvent | RoutineRow | DayRow

/**
 * Where the rows go: VITE_USAGE_ENDPOINT (…/api/usage), or for a phone tagged with a team's pilot
 * that team's endpoint (…/api/team-usage?team=…), which stores visits and routines in its database.
 */
export const usageEndpoint = (base: string | undefined, team: Team | null): string | undefined =>
  base && team ? base.replace(/\/api\/usage\/?$/, `/api/team-usage?team=${team}`) : base

/** routine rows go to their own endpoint next to the visits' one: /api/usage → /api/usage-routine */
export const routineEndpoint = (endpoint: string): string | null =>
  /\/api\/usage\/?$/.test(endpoint) ? endpoint.replace(/\/api\/usage\/?$/, '/api/usage-routine') : null

type State = {
  consent: boolean
  firstDay: string | null
  lastDay: string | null
  lastWeek: string | null
  lastLifeWeek: number | null
  lastHiddenAt: number | null
  /** ISO week of the last visit with My patterns opened, and whether it was ever opened */
  patternsWeek: string | null
  patternsSeen: boolean
  /** the day being added up for its period day row (only while those rows are on) */
  today: { day: string; visits: number; seconds: number; checkins: number } | null
  queue: UsageRow[]
}

const STORAGE_KEY = 'bab.usage-stats.v1'
/** set once the athlete has answered, yes or no (kept apart: saying no wipes the stats state) */
const ANSWERED_KEY = 'bab.usage-consent-answered'
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
  patternsWeek: null,
  patternsSeen: false,
  today: null,
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
let visitPatternsViews = 0
/** a reminder tap can arrive just before the app reports it is in the foreground */
let pendingFromReminder = false
let reminderOn = false

/** Call when a new check-in has been saved. */
export const recordCheckIn = (): void => {
  visitCheckins += 1
}

/** Call when the My patterns tab is shown. */
export const recordPatternsView = (): void => {
  visitPatternsViews += 1
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
  safeStorage.setItem(ANSWERED_KEY, '1')
}

/** Whether the athlete has already chosen (in the first-open question or in Settings). */
export const hasAnsweredUsageConsent = (): boolean =>
  safeStorage.getItem(ANSWERED_KEY) === '1' || loadState().consent

type Options = {
  endpoint?: string
  platform?: AppPlatform
  native?: boolean
  /** false in a browser tab or on a computer: nothing is measured (defaults to usageStatsCounted()) */
  counted?: boolean
  now?: () => number
  send?: (endpoint: string, events: UsageRow[]) => Promise<boolean>
  doc?: Document
  /** the training routine to report once a week (Settings → Training and matches) */
  routine?: () => Session[]
  /** send the period day rows (see DayRow): off unless VITE_PERIOD_STATS=on on a team's phone */
  periodStats?: boolean
  /** the athlete's answer to "period today?" for a day: yes, no, or null = not answered */
  periodOf?: (day: string) => boolean | null
}

const isRoutineRow = (row: UsageRow): row is RoutineRow => 'kind' in row && row.kind === 'routine'
const isDayRow = (row: UsageRow): row is DayRow => 'kind' in row && row.kind === 'day'

/** whether a day has a match, a training or no session in the weekly routine */
export const sessionDayOf = (date: Date, sessions: Session[]): SessionDay => {
  const weekday = date.getDay() || 7
  const that = sessions.filter((s) => s.day === weekday)
  return that.some((s) => s.kind === 'match') ? 'match' : that.length > 0 ? 'training' : 'none'
}

const post = async (endpoint: string, events: UsageRow[]): Promise<boolean> => {
  if (events.length === 0) return true
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

const defaultSend = async (endpoint: string, events: UsageRow[]): Promise<boolean> => {
  // a team's endpoint takes visits and routines together
  if (endpoint.includes('/api/team-usage')) return post(endpoint, events)
  const routines = events.filter(isRoutineRow)
  // period day rows exist only for a team's endpoint
  const visits = events.filter((row) => !('kind' in row))
  const routineUrl = routineEndpoint(endpoint)
  const [visitsOk, routinesOk] = await Promise.all([
    post(endpoint, visits),
    routineUrl ? post(routineUrl, routines) : Promise.resolve(true),
  ])
  return visitsOk && routinesOk
}

/** Starts measuring visits. Returns a function that stops listening (used by tests). */
export const startUsageStats = ({
  endpoint = usageEndpoint(import.meta.env.VITE_USAGE_ENDPOINT as string | undefined, currentTeam()),
  platform = appPlatform(),
  native = isNativeApp(),
  counted = usageStatsCounted(native),
  now = Date.now,
  send = defaultSend,
  doc = document,
  routine = getTrainingRoutine,
  periodStats = import.meta.env.VITE_PERIOD_STATS === 'on' && currentTeam() !== null,
  periodOf = hadPeriodOn,
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
    const patternsViews = visitPatternsViews
    visitCheckins = 0
    visitFromReminder = false
    visitPatternsViews = 0
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
      session_day: sessionDayOf(date, routine()),
      patterns_views: patternsViews,
      patterns_first_of_week: patternsViews > 0 && state.patternsWeek !== week,
      patterns_first_ever: patternsViews > 0 && !state.patternsSeen,
    }

    // the period day row of an earlier day is ready once a new day starts; the answer to "period
    // today?" is read only then, when she can no longer change it from that day's check-ins
    const dayRows: DayRow[] = []
    let today = periodStats ? state.today : null
    if (today && today.day !== day) {
      dayRows.push({
        v: 3,
        kind: 'day',
        week: isoWeekKey(parseISO(today.day)),
        on_period: periodOf(today.day),
        visits: today.visits,
        seconds: today.seconds,
        checkins: today.checkins,
        platform,
      })
      today = null
    }
    if (periodStats) {
      const sum = today ?? { day, visits: 0, seconds: 0, checkins: 0 }
      today = {
        day,
        visits: sum.visits + (continued ? 0 : 1),
        seconds: sum.seconds + event.seconds,
        checkins: sum.checkins + checkins,
      }
    }

    saveState({
      ...state,
      firstDay,
      lastDay: day,
      lastWeek: week,
      lastLifeWeek: lifeWeek,
      lastHiddenAt: endedAt,
      patternsWeek: patternsViews > 0 ? week : state.patternsWeek,
      patternsSeen: state.patternsSeen || patternsViews > 0,
      today,
      queue: [
        // weekly summaries sent by older versions are dropped
        ...state.queue.filter((row) => !('kind' in row) || isRoutineRow(row) || isDayRow(row)),
        ...dayRows,
        // the first visit of a week also reports the routine as it stands
        ...(event.first_of_week ? [{ v: 3 as const, kind: 'routine' as const, week, sessions: routine(), platform }] : []),
        event,
      ].slice(-MAX_QUEUE),
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
    visitPatternsViews = 0
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
