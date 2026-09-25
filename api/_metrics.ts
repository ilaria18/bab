/**
 * The pilot's metrics, computed from the rows of usage_visits and usage_weeks.
 * Same definitions as analytics/metrics.sql, so the dashboard and the SQL queries always agree.
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
}

export type WeekRow = { week: string; active_days: string; platform: string }

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

export type PilotMetrics = ReturnType<typeof computeMetrics>

export const computeMetrics = (start: string, allVisits: VisitRow[], allWeeks: WeekRow[], platform: string | null) => {
  const end = addDays(start, PILOT_DAYS)
  const visits = allVisits.filter((r) => r.day >= start && r.day < end && (!platform || r.platform === platform))
  const weeksRows = allWeeks.filter((r) => !platform || r.platform === platform)
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
      rawActiveUsers: t.activeUsers, // used below, removed before sending
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

  // how use is spread across the team, from the weekly summaries
  const spread = weeks.map((w) => {
    const key = isoWeek(w.from)
    const reports = weeksRows.filter((r) => r.week === key)
    const count = (band: string) => reports.filter((r) => r.active_days === band).length
    const ok = reports.length >= MIN_GROUP
    return {
      pilotWeek: w.pilotWeek,
      days1to2: ok ? count('1-2') : null,
      days3to4: ok ? count('3-4') : null,
      days5to7: ok ? count('5-7') : null,
      reported: reports.length,
      notReported: w.rawActiveUsers >= MIN_GROUP ? Math.max(w.rawActiveUsers - reports.length, 0) : null,
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
    weeks: weeks.map(({ rawActiveUsers: _omit, ...w }) => w),
    retention,
    spread,
    lengths,
  }
}
