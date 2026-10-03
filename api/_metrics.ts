/**
 * The pilot's metrics, computed from the rows of usage_visits (analytics/setup.sql).
 *
 * Every figure that describes "per athlete" behaviour, or that is computed over fewer than
 * MIN_GROUP athletes, comes back as null: with a single team, small groups would let someone
 * read an individual's behaviour off the numbers.
 *
 * (Files in api/ starting with "_" are not deployed as endpoints: this is a helper for metrics.ts.)
 */

export const MIN_GROUP = 5
export const PILOT_DAYS = 35
export const PILOT_WEEKS = 5

export type VisitRow = {
  day: string
  seconds: number
  cohort_week: string
  week_since_first: number
  first_ever: boolean
  first_of_day: boolean
  first_of_week: boolean
  first_of_life_week: boolean
  continued: boolean
  platform: string
  checkins: number | null
  from_reminder: boolean | null
  reminder_on: boolean | null
  /** only in the team pilots' databases; null/absent = an older version of the app */
  session_day?: string | null
  patterns_views?: number | null
  patterns_first_of_week?: boolean | null
  patterns_first_ever?: boolean | null
}

/** period day rows (usage_days, team pilots only, off unless PERIOD_STATS=on) */
export type PeriodDayRow = {
  week: string
  on_period: boolean | null
  visits: number
  seconds: number
  checkins: number
  platform: string
}

const DAY_MS = 86_400_000
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`)
const addDays = (day: string, n: number) => new Date(toTime(day) + n * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY_MS)

/** ISO week key, e.g. 2026-W41 */
export const isoWeek = (day: string): string => {
  const d = new Date(toTime(day))
  const weekday = (d.getUTCDay() + 6) % 7 // Monday = 0
  const thursday = new Date(d.getTime() + (3 - weekday) * DAY_MS)
  const year = thursday.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(year, 0, 4))
  const firstWeekMonday = firstThursday.getTime() - ((firstThursday.getUTCDay() + 6) % 7) * DAY_MS
  const week = 1 + Math.floor((thursday.getTime() - firstWeekMonday) / (7 * DAY_MS))
  return `${year}-W${String(week).padStart(2, '0')}`
}

const round1 = (n: number) => Math.round(n * 10) / 10
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : null)
/** a per-athlete figure, hidden when the group is too small */
const perAthlete = (value: number, athletes: number) => (athletes >= MIN_GROUP ? round1(value / athletes) : null)
const shown = (count: number) => (count >= MIN_GROUP ? count : null)

type Totals = {
  openings: number
  activeUsers: number
  userDays: number
  checkins: number
  fromReminder: number
  seconds: number
  usersWithReminder: number
  usersReminderKnown: number
}

const totalsOf = (rows: VisitRow[], firstFlag: 'first_of_day' | 'first_of_week'): Totals => {
  const t: Totals = {
    openings: 0, activeUsers: 0, userDays: 0, checkins: 0, fromReminder: 0, seconds: 0,
    usersWithReminder: 0, usersReminderKnown: 0,
  }
  for (const r of rows) {
    if (!r.continued) t.openings += 1
    if (r[firstFlag]) t.activeUsers += 1
    if (r.first_of_day) t.userDays += 1
    t.checkins += r.checkins ?? 0
    if (r.from_reminder) t.fromReminder += 1
    t.seconds += r.seconds
    if (r.first_of_week && r.reminder_on !== null) {
      t.usersReminderKnown += 1
      if (r.reminder_on) t.usersWithReminder += 1
    }
  }
  return t
}

export type RoutineWeekRow = {
  week: string
  sessions: { day: number; kind: string; start: string; end: string }[] | null
  platform: string
}

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : round1((s[m - 1] + s[m]) / 2)
}
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The weekly routines (one row per phone and week, no identifier): the planned training load.
 * Every figure needs at least MIN_GROUP phones reporting that week. */
const routineWeeks = (start: string, rows: RoutineWeekRow[]) =>
  Array.from({ length: PILOT_WEEKS }, (_, i) => {
    const from = addDays(start, i * 7)
    const list = rows.filter((r) => r.week === isoWeek(from))
    const withRoutine = list.filter((r) => (r.sessions ?? []).length > 0)
    const ok = list.length >= MIN_GROUP
    const okRoutine = withRoutine.length >= MIN_GROUP
    const sessions = (r: RoutineWeekRow) => r.sessions ?? []
    const minutes = (r: RoutineWeekRow, kind: string) =>
      sessions(r).filter((s) => s.kind === kind).reduce((sum, s) => sum + Math.max(minutesOf(s.end) - minutesOf(s.start), 0), 0)
    return {
      pilotWeek: i + 1,
      from,
      reported: list.length,
      withRoutinePct: ok ? pct(withRoutine.length, list.length) : null,
      sessionsPerAthlete: okRoutine ? median(withRoutine.map((r) => sessions(r).length)) : null,
      trainingMinutes: okRoutine ? median(withRoutine.map((r) => minutes(r, 'training'))) : null,
      matchMinutes: okRoutine ? median(withRoutine.map((r) => minutes(r, 'match'))) : null,
      matches: okRoutine ? median(withRoutine.map((r) => sessions(r).filter((s) => s.kind === 'match').length)) : null,
      /** share of the athletes with a routine who have a session on each weekday */
      byWeekday: okRoutine
        ? WEEKDAYS.map((label, d) => ({ label, pct: pct(withRoutine.filter((r) => sessions(r).some((s) => s.day === d + 1)).length, withRoutine.length) }))
        : [],
    }
  })

/** a typical athlete-day of each group, from "days on which an athlete opened the app" */
const perDay = (athleteDays: number, openings: number, seconds: number, checkins: number, daysWithCheckIn: number, ok: boolean) => ({
  athleteDays: ok ? athleteDays : null,
  openingsPerDay: ok ? round1(openings / athleteDays) : null,
  minutesPerDay: ok ? round1(seconds / 60 / athleteDays) : null,
  checkinsPerDay: ok ? round1(checkins / athleteDays) : null,
  daysWithCheckInPct: ok ? pct(daysWithCheckIn, athleteDays) : null,
})

/** most athletes active in one week: below MIN_GROUP every split is hidden, whatever its size */
const enoughAthletes = (visits: VisitRow[], start: string) => {
  const perWeek = new Map<number, number>()
  for (const r of visits) {
    if (!r.first_of_week) continue
    const w = Math.floor(daysBetween(start, r.day) / 7)
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1)
  }
  return Math.max(0, ...perWeek.values()) >= MIN_GROUP
}

/** Days with a match, a training or no session in the athlete's routine: how she uses the app.
 * An athlete-day = one athlete, one day on which she opened the app. */
const sessionDays = (visits: VisitRow[], ok: boolean) =>
  (['match', 'training', 'none'] as const).map((kind) => {
    const rows = visits.filter((r) => r.session_day === kind)
    const athleteDays = rows.filter((r) => r.first_of_day).length
    const openings = rows.filter((r) => !r.continued).length
    const seconds = rows.reduce((sum, r) => sum + r.seconds, 0)
    const checkins = rows.reduce((sum, r) => sum + (r.checkins ?? 0), 0)
    // visits can't be grouped into days (no identifier), so "days with a check-in" is not known here
    return { kind, ...perDay(athleteDays, openings, seconds, checkins, 0, ok && athleteDays >= MIN_GROUP), daysWithCheckInPct: null }
  })

/** My patterns, week by week: how many of the active athletes opened it, and how often */
const patternsWeeks = (start: string, visits: VisitRow[]) =>
  Array.from({ length: PILOT_WEEKS }, (_, i) => {
    const rows = visits.filter(
      (r) => Math.floor(daysBetween(start, r.day) / 7) === i && r.patterns_views !== null && r.patterns_views !== undefined,
    )
    const active = rows.filter((r) => r.first_of_week).length
    const looked = rows.filter((r) => r.patterns_first_of_week).length
    const views = rows.reduce((sum, r) => sum + (r.patterns_views ?? 0), 0)
    const openings = rows.filter((r) => !r.continued)
    const ok = active >= MIN_GROUP
    return {
      pilotWeek: i + 1,
      from: addDays(start, i * 7),
      active: shown(active),
      lookedPct: ok ? pct(looked, active) : null,
      viewsPerActive: perAthlete(views, active),
      viewsPerLooker: ok && looked > 0 ? round1(views / looked) : null,
      openingsWithPatternsPct: ok ? pct(openings.filter((r) => (r.patterns_views ?? 0) > 0).length, openings.length) : null,
    }
  })

/** Period and app use, from the period day rows (one per athlete and day of use) */
const periodGroups = (rows: PeriodDayRow[], ok: boolean) =>
  ([true, false, null] as const).map((onPeriod) => {
    const list = rows.filter((r) => r.on_period === onPeriod)
    const sum = (key: 'visits' | 'seconds' | 'checkins') => list.reduce((total, r) => total + r[key], 0)
    return {
      onPeriod,
      ...perDay(list.length, sum('visits'), sum('seconds'), sum('checkins'), list.filter((r) => r.checkins > 0).length, ok && list.length >= MIN_GROUP),
    }
  })

export type PilotMetrics = ReturnType<typeof computeMetrics>

export const computeMetrics = (
  start: string,
  allVisits: VisitRow[],
  platform: string | null,
  allRoutines: RoutineWeekRow[] = [],
  /** null = the period day rows are off (PERIOD_STATS) */
  allPeriodDays: PeriodDayRow[] | null = null,
) => {
  const end = addDays(start, PILOT_DAYS)
  const visits = allVisits.filter((r) => r.day >= start && r.day < end && (!platform || r.platform === platform))
  const pilotWeekOf = (day: string) => Math.floor(daysBetween(start, day) / 7) + 1

  const days = Array.from({ length: PILOT_DAYS }, (_, i) => {
    const day = addDays(start, i)
    const t = totalsOf(visits.filter((r) => r.day === day), 'first_of_day')
    return {
      day,
      pilotWeek: Math.floor(i / 7) + 1,
      openings: t.openings,
      activeUsers: shown(t.activeUsers),
      openingsPerUser: perAthlete(t.openings, t.activeUsers),
      checkins: t.checkins,
      checkinsPerUser: perAthlete(t.checkins, t.activeUsers),
      openingsFromReminder: t.fromReminder,
      minutesPerOpening: t.openings > 0 ? round1(t.seconds / 60 / t.openings) : null,
      minutesPerUser: perAthlete(t.seconds / 60, t.activeUsers),
    }
  })

  const weeks = Array.from({ length: PILOT_WEEKS }, (_, i) => {
    const pilotWeek = i + 1
    const t = totalsOf(visits.filter((r) => pilotWeekOf(r.day) === pilotWeek), 'first_of_week')
    return {
      pilotWeek,
      from: addDays(start, i * 7),
      to: addDays(start, i * 7 + 6),
      openings: t.openings,
      activeUsers: shown(t.activeUsers),
      openingsPerUser: perAthlete(t.openings, t.activeUsers),
      daysUsedPerUser: perAthlete(t.userDays, t.activeUsers),
      checkins: t.checkins,
      checkinsPerUser: perAthlete(t.checkins, t.activeUsers),
      openingsFromReminderPct: pct(t.fromReminder, t.openings),
      reminderOnPct: t.usersReminderKnown >= MIN_GROUP ? pct(t.usersWithReminder, t.usersReminderKnown) : null,
      minutesPerOpening: t.openings > 0 ? round1(t.seconds / 60 / t.openings) : null,
      minutesPerUser: perAthlete(t.seconds / 60, t.activeUsers),
    }
  })

  // retention: athletes who started during the pilot, week by week of their own use
  const startWeek = isoWeek(start)
  const started = visits.filter((r) => r.first_ever).length
  const retention = Array.from({ length: PILOT_WEEKS }, (_, k) => {
    const stillActive = visits.filter(
      (r) => r.first_of_life_week && r.week_since_first === k && r.cohort_week >= startWeek,
    ).length
    const ok = started >= MIN_GROUP
    return {
      lifeWeek: k + 1,
      started,
      stillActive,
      retentionPct: ok ? pct(stillActive, started) : null,
      churnPct: ok ? 100 - (pct(stillActive, started) ?? 0) : null,
    }
  })

  // visit length and how many end with a check-in
  const buckets = [
    { label: '< 1 min', min: 0, max: 60 },
    { label: '1–3 min', min: 60, max: 180 },
    { label: '3–5 min', min: 180, max: 300 },
    { label: '> 5 min', min: 300, max: Infinity },
  ]
  const openings = visits.filter((r) => !r.continued)
  const lengths = buckets.map((b) => {
    const inBucket = openings.filter((r) => r.seconds >= b.min && r.seconds < b.max)
    const known = inBucket.filter((r) => r.checkins !== null)
    return {
      label: b.label,
      openings: inBucket.length,
      withCheckIn: known.filter((r) => (r.checkins ?? 0) > 0).length,
      withCheckInPct: known.length > 0 ? pct(known.filter((r) => (r.checkins ?? 0) > 0).length, known.length) : null,
    }
  })

  const weeksWithData = weeks.filter((w) => w.openings > 0)
  const latest = weeksWithData[weeksWithData.length - 1] ?? null
  const summary = {
    started: shown(started),
    totalOpenings: openings.length,
    totalCheckins: visits.reduce((sum, r) => sum + (r.checkins ?? 0), 0),
    latestWeek: latest?.pilotWeek ?? null,
    latestWeekActive: latest?.activeUsers ?? null,
    latestRetentionPct: latest ? retention[latest.pilotWeek - 1]?.retentionPct ?? null : null,
    openingsFromReminderPct: pct(visits.filter((r) => r.from_reminder).length, openings.length),
    lastDataDay: visits.reduce<string | null>((last, r) => (last === null || r.day > last ? r.day : last), null),
  }

  return {
    start,
    end: addDays(start, PILOT_DAYS - 1),
    platform: platform ?? 'all',
    minGroup: MIN_GROUP,
    summary,
    days,
    weeks,
    retention,
    lengths,
    routines: routineWeeks(start, allRoutines.filter((r) => !platform || r.platform === platform)),
    sessionDays: sessionDays(visits, enoughAthletes(visits, start)),
    patterns: {
      weeks: patternsWeeks(start, visits),
      everOpened: shown(visits.filter((r) => r.patterns_first_ever).length),
      /** athletes counted since the app sends My patterns (their first visit of a week on the new app) */
      tracked: visits.some((r) => r.patterns_views !== null && r.patterns_views !== undefined),
    },
    period: allPeriodDays === null
      ? null
      : (() => {
          const weeks = new Set(Array.from({ length: PILOT_WEEKS }, (_, i) => isoWeek(addDays(start, i * 7))))
          const rows = allPeriodDays.filter((r) => weeks.has(r.week) && (!platform || r.platform === platform))
          return { groups: periodGroups(rows, enoughAthletes(visits, start)), athleteDays: shown(rows.length) }
        })(),
  }
}
