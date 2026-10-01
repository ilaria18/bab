/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto'
import { dbError, json, supabase } from './_reminders.js'

/**
 * Anonymous feedback from the athletes (the app's "Feedback" tab).
 *
 * POST { kind, message, screen }                  stores one message (anyone with the app)
 * GET  ?start=YYYY-MM-DD  + Authorization: Bearer <DASHBOARD_PASSWORD>
 *                                                  the messages for the dashboard, newest first
 *
 * Stored in `feedback` (analytics/setup.sql) with only the WEEK it arrived (its Monday, in the
 * `day` column): no day, no time, no language, no name, no participant code, no IP or device id.
 * In a small team, the day or the language could point at one athlete.
 */

const KINDS = ['like', 'idea', 'problem']
const SCREENS = ['general', 'check-in', 'journal', 'patterns', 'world', 'settings', 'reminders']
const MAX_MESSAGE = 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = (await request.json()) as unknown
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/** Monday of the week of a YYYY-MM-DD day */
export const weekStart = (day: string): string => {
  const d = new Date(`${day}T12:00:00Z`)
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
}

/** Rebuilt field by field: anything else in the request is dropped. Null if invalid. */
export const toFeedbackRow = (body: Record<string, unknown> | null, today: string) => {
  if (!body) return null
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!KINDS.includes(body.kind as string)) return null
  if (message.length === 0 || message.length > MAX_MESSAGE) return null
  return {
    day: weekStart(today),
    kind: body.kind as string,
    message,
    screen: SCREENS.includes(body.screen as string) ? (body.screen as string) : 'general',
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!configured()) return json(503, { error: 'not_configured' })
  const row = toFeedbackRow(await readJson(request), new Date().toISOString().slice(0, 10))
  if (!row) return json(400, { error: 'invalid' })
  const response = await supabase('feedback', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  })
  if (!response.ok) {
    console.error('Could not save the feedback', await dbError(response))
    return json(502, { error: 'database' })
  }
  return json(200, { ok: true })
}

const passwordMatches = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected || !configured()) return json(503, { error: 'not_configured' })
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!passwordMatches(given, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 800)) // slows down guessing
    return json(401, { error: 'wrong_password' })
  }
  const start = new URL(request.url).searchParams.get('start')
  const filter = start && DAY.test(start) ? `&day=gte.${weekStart(start)}` : ''
  const response = await supabase(`feedback?select=day,kind,screen,message&order=day.desc,id.desc&limit=500${filter}`)
  if (!response.ok) {
    console.error('Could not read the feedback', await dbError(response))
    return json(502, { error: 'database' })
  }
  const items = (await response.json()) as { day: string; kind: string; screen: string; message: string }[]
  const counts = Object.fromEntries(KINDS.map((kind) => [kind, items.filter((i) => i.kind === kind).length]))
  return json(200, { counts, items })
}
