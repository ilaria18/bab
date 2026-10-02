/// <reference types="node" />
import { dbError, supabase } from './_reminders.js'

/**
 * The weekly training/match routine, sent by src/features/usage-stats/usageStats.ts with the first
 * visit of each week (only with the athlete's consent to the anonymous statistics, only from the
 * installed app). Stored in `usage_routines` (analytics/setup.sql): ISO week, sessions (weekday,
 * training or match, start, end) and phone type — no identifier of any kind, and nothing that links
 * a row to the visits or to another week's row. An empty list means "no routine entered".
 *
 * Rows are rebuilt field by field: nothing else the client sends, and nothing about the request
 * (IP address, user agent), reaches the database.
 */

const APP_ORIGINS = ['capacitor://localhost', 'https://localhost']
const PLATFORMS = ['ios', 'android', 'web']
const WEEK = /^\d{4}-W\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_SESSIONS = 14

export type RoutineRow = {
  week: string
  sessions: { day: number; kind: 'training' | 'match'; start: string; end: string }[]
  platform: string
}

export const toRoutineRow = (input: unknown): RoutineRow | null => {
  if (typeof input !== 'object' || input === null) return null
  const e = input as Record<string, unknown>
  if (e.v !== 3 || e.kind !== 'routine') return null
  if (typeof e.week !== 'string' || !WEEK.test(e.week)) return null
  if (typeof e.platform !== 'string' || !PLATFORMS.includes(e.platform)) return null
  if (!Array.isArray(e.sessions) || e.sessions.length > MAX_SESSIONS) return null
  const sessions: RoutineRow['sessions'] = []
  for (const item of e.sessions) {
    const s = item as Record<string, unknown> | null
    if (
      !s ||
      !Number.isInteger(s.day) ||
      (s.day as number) < 1 ||
      (s.day as number) > 7 ||
      (s.kind !== 'training' && s.kind !== 'match') ||
      typeof s.start !== 'string' ||
      !TIME.test(s.start) ||
      typeof s.end !== 'string' ||
      !TIME.test(s.end)
    ) {
      return null
    }
    sessions.push({ day: s.day as number, kind: s.kind, start: s.start, end: s.end })
  }
  return { week: e.week, sessions, platform: e.platform }
}

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
  const body = await request.text()
  if (body.length > 64_000) return new Response(null, { status: 413, headers })
  let events: unknown
  try {
    events = JSON.parse(body)
  } catch {
    return new Response(null, { status: 400, headers })
  }
  if (!Array.isArray(events) || events.length > 50) return new Response(null, { status: 400, headers })
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return new Response(null, { status: 503, headers })

  const rows = events.map(toRoutineRow).filter((row): row is RoutineRow => row !== null)
  if (rows.length > 0) {
    const response = await supabase('usage_routines', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!response.ok) {
      console.error('Supabase refused the insert into usage_routines', await dbError(response))
      // 5xx makes the app keep the rows and try again at the next opening
      return new Response(null, { status: 502, headers })
    }
  }
  // malformed rows are dropped rather than retried forever
  return new Response(null, { status: 204, headers })
}
