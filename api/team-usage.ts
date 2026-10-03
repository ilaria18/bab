/// <reference types="node" />
import { databaseConfigured, dbError, supabaseFor, teamOf } from './_reminders.js'
import { toRoutineRow, type RoutineRow } from './usage-routine.js'

/**
 * The anonymous usage statistics of a team with its own pilot (POST /api/team-usage?team=verovolley):
 * the same visit rows as api/usage.ts and the weekly routine rows as api/usage-routine.ts, sent by
 * phones that opened the team's link, stored in that team's own database (see TEAMS in
 * api/_reminders.ts). Same rules: rows rebuilt field by field, nothing about the request kept.
 * (Visit rows are checked as in api/usage.ts, plus the fields only the team pilots store: the
 * session day and My patterns; kept in a separate file so the two can be deployed independently.)
 *
 * Period day rows (usage_days) are stored only with PERIOD_STATS=on in Vercel: whether a day was a
 * period day is health data of a minor, so they stay off until the lawyer, the information notice
 * and the parental consents allow them. While off they are accepted and thrown away.
 */

const APP_ORIGINS = ['capacitor://localhost', 'https://localhost']
const PLATFORMS = ['ios', 'android', 'web']
const DAY = /^\d{4}-\d{2}-\d{2}$/
const WEEK = /^\d{4}-W\d{2}$/
const SESSION_DAYS = ['training', 'match', 'none']

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
  checkins: number
  from_reminder: boolean
  reminder_on: boolean
  /** null = sent by a version of the app from before these fields */
  session_day: string | null
  patterns_views: number | null
  patterns_first_of_week: boolean | null
  patterns_first_ever: boolean | null
}

const optionalBoolean = (value: unknown) => (typeof value === 'boolean' ? value : null)

/** a visit row of the current app version (v3); anything else is dropped */
export const toVisitRow = (input: unknown): VisitRow | null => {
  if (typeof input !== 'object' || input === null) return null
  const e = input as Record<string, unknown>
  if (e.v !== 3 || e.kind !== undefined) return null
  const flags = ['first_ever', 'first_of_day', 'first_of_week', 'first_of_life_week', 'continued', 'from_reminder', 'reminder_on'] as const
  if (flags.some((flag) => typeof e[flag] !== 'boolean')) return null
  if (typeof e.platform !== 'string' || !PLATFORMS.includes(e.platform)) return null
  if (typeof e.day !== 'string' || !DAY.test(e.day)) return null
  if (typeof e.cohort_week !== 'string' || !WEEK.test(e.cohort_week)) return null
  if (!Number.isInteger(e.seconds) || (e.seconds as number) < 0) return null
  if (!Number.isInteger(e.week_since_first) || (e.week_since_first as number) < 0) return null
  if (!Number.isInteger(e.checkins) || (e.checkins as number) < 0) return null
  return {
    day: e.day,
    // a visit longer than 3 hours is an app left open on the table
    seconds: Math.min(e.seconds as number, 3 * 60 * 60),
    cohort_week: e.cohort_week,
    week_since_first: e.week_since_first as number,
    first_ever: e.first_ever as boolean,
    first_of_day: e.first_of_day as boolean,
    first_of_week: e.first_of_week as boolean,
    first_of_life_week: e.first_of_life_week as boolean,
    continued: e.continued as boolean,
    platform: e.platform,
    checkins: Math.min(e.checkins as number, 50),
    from_reminder: e.from_reminder as boolean,
    reminder_on: e.reminder_on as boolean,
    session_day: typeof e.session_day === 'string' && SESSION_DAYS.includes(e.session_day) ? e.session_day : null,
    patterns_views: Number.isInteger(e.patterns_views) && (e.patterns_views as number) >= 0 ? Math.min(e.patterns_views as number, 50) : null,
    patterns_first_of_week: optionalBoolean(e.patterns_first_of_week),
    patterns_first_ever: optionalBoolean(e.patterns_first_ever),
  }
}

export type DayRow = {
  week: string
  on_period: boolean | null
  visits: number
  seconds: number
  checkins: number
  platform: string
}

/** a period day row (see DayRow in src/features/usage-stats/usageStats.ts); anything else is dropped */
export const toDayRow = (input: unknown): DayRow | null => {
  if (typeof input !== 'object' || input === null) return null
  const e = input as Record<string, unknown>
  if (e.v !== 3 || e.kind !== 'day') return null
  if (typeof e.week !== 'string' || !WEEK.test(e.week)) return null
  if (e.on_period !== null && typeof e.on_period !== 'boolean') return null
  if (typeof e.platform !== 'string' || !PLATFORMS.includes(e.platform)) return null
  const count = (value: unknown) => Number.isInteger(value) && (value as number) >= 0
  if (!count(e.visits) || !count(e.seconds) || !count(e.checkins)) return null
  return {
    week: e.week,
    on_period: e.on_period as boolean | null,
    visits: Math.min(e.visits as number, 100),
    seconds: Math.min(e.seconds as number, 24 * 60 * 60),
    checkins: Math.min(e.checkins as number, 100),
    platform: e.platform,
  }
}

export const periodStatsOn = (): boolean => process.env.PERIOD_STATS === 'on'

const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('origin') ?? ''
  const extra = (process.env.USAGE_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)
  return [...APP_ORIGINS, ...extra].includes(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', Vary: 'Origin' }
    : {}
}

export function OPTIONS(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: Request): Promise<Response> {
  const headers = corsHeaders(request)
  const team = teamOf(request)
  // no team or an unknown one: refused for good (4xx), the app does not retry
  if (team === null || team === 'invalid') return new Response(null, { status: 400, headers })
  const body = await request.text()
  if (body.length > 64_000) return new Response(null, { status: 413, headers })
  let events: unknown
  try {
    events = JSON.parse(body)
  } catch {
    return new Response(null, { status: 400, headers })
  }
  if (!Array.isArray(events) || events.length > 50) return new Response(null, { status: 400, headers })
  if (!databaseConfigured(team)) {
    console.error(`The database of team ${team} is not configured`)
    // 5xx: the app keeps the rows and sends them once the database is set up
    return new Response(null, { status: 503, headers })
  }

  const visits = events.map(toVisitRow).filter((row): row is VisitRow => row !== null)
  const routines = events.map(toRoutineRow).filter((row): row is RoutineRow => row !== null)
  const days = periodStatsOn() ? events.map(toDayRow).filter((row): row is DayRow => row !== null) : []
  const db = supabaseFor(team)
  for (const [table, rows] of [['usage_visits', visits], ['usage_routines', routines], ['usage_days', days]] as const) {
    if (rows.length === 0) continue
    const response = await db(table, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) })
    if (!response.ok) {
      console.error(`Could not save ${table} for team ${team}`, await dbError(response))
      return new Response(null, { status: 502, headers })
    }
  }
  return new Response(null, { status: 204, headers })
}
