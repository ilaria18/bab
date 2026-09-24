/**
 * Receives the anonymous visit rows sent by src/features/usage-stats/usageStats.ts and stores
 * them in the `usage_visits` table (analytics/schema.sql) through Supabase's REST API.
 *
 * The row is rebuilt field by field, so nothing the client adds on top — and nothing about the
 * request itself (IP address, user agent, headers) — ever reaches the database. The insert is
 * made from this server, so Supabase only ever sees Vercel's address, not the athlete's.
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL                  https://<project>.supabase.co  (create the project in an EU region)
 *   SUPABASE_SERVICE_ROLE_KEY     server-side key, never exposed to the app
 *   USAGE_ALLOWED_ORIGINS         optional, comma separated, e.g. capacitor://localhost,https://localhost
 */

type Row = {
  day: string
  seconds: number
  cohort_week: string
  week_since_first: number
  first_ever: boolean
  first_of_day: boolean
  first_of_week: boolean
  first_of_life_week: boolean
  continued: boolean
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const WEEK = /^\d{4}-W\d{2}$/

const toRow = (input: unknown): Row | null => {
  if (typeof input !== 'object' || input === null) return null
  const e = input as Record<string, unknown>
  const flags = ['first_ever', 'first_of_day', 'first_of_week', 'first_of_life_week', 'continued'] as const
  if (e.v !== 1) return null
  if (typeof e.day !== 'string' || !DAY.test(e.day)) return null
  if (typeof e.cohort_week !== 'string' || !WEEK.test(e.cohort_week)) return null
  if (!Number.isInteger(e.seconds) || (e.seconds as number) < 0) return null
  if (!Number.isInteger(e.week_since_first) || (e.week_since_first as number) < 0) return null
  if (flags.some((flag) => typeof e[flag] !== 'boolean')) return null
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
  }
}

const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (process.env.USAGE_ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim())
  return allowed.includes(origin)
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

  const rows = events.map(toRow).filter((row): row is Row => row !== null)
  if (rows.length > 0) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/usage_visits`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    })
    // 5xx makes the app keep the rows and try again at the next opening
    if (!response.ok) return new Response(null, { status: 502, headers })
  }
  // malformed rows are dropped rather than retried forever
  return new Response(null, { status: 204, headers })
}
