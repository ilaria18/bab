/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto'
import { computeMetrics, isoWeek, PILOT_DAYS, type VisitRow, type WeekRow } from './_metrics.js'

/**
 * The pilot's metrics for the dashboard (public/dashboard.html), as JSON.
 *
 * GET /api/metrics?start=YYYY-MM-DD&platform=ios|android
 * Header: Authorization: Bearer <DASHBOARD_PASSWORD>
 *
 * Reads the anonymous rows from Supabase with the server's secret key and returns only aggregates
 * (small groups hidden). The raw rows never leave this function.
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   as for api/usage.ts
 *   DASHBOARD_PASSWORD                        the password Gaia types in the dashboard (long and random)
 *   PILOT_START                               optional, the pilot's first day (YYYY-MM-DD), the dashboard's default
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/
const PAGE = 1000

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const passwordMatches = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Reads every row matching `query` from a table, a page at a time. */
const readAll = async <T>(table: string, query: string): Promise<T[]> => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: key,
        ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
        'User-Agent': 'bab-metrics-endpoint/1.0',
        'Range-Unit': 'items',
        Range: `${from}-${from + PAGE - 1}`,
      },
    })
    if (!response.ok) throw new Error(`Supabase ${table}: ${response.status} ${await response.text()}`)
    const page = (await response.json()) as T[]
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.DASHBOARD_PASSWORD
  if (!expected || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('DASHBOARD_PASSWORD, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
    return json(503, { error: 'not_configured' })
  }
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!passwordMatches(given, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 800)) // slows down guessing
    return json(401, { error: 'wrong_password' })
  }

  const url = new URL(request.url)
  const start = url.searchParams.get('start') || process.env.PILOT_START || ''
  if (!DAY.test(start)) return json(400, { error: 'start_missing', pilotStart: process.env.PILOT_START ?? null })
  const platformParam = url.searchParams.get('platform')
  const platform = platformParam === 'ios' || platformParam === 'android' || platformParam === 'web' ? platformParam : null

  const end = new Date(Date.parse(`${start}T00:00:00Z`) + PILOT_DAYS * 86_400_000).toISOString().slice(0, 10)
  const pilotWeeks = Array.from({ length: 5 }, (_, i) =>
    isoWeek(new Date(Date.parse(`${start}T00:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10)),
  )

  try {
    const [visits, weeks] = await Promise.all([
      readAll<VisitRow>('usage_visits', `select=*&day=gte.${start}&day=lt.${end}`),
      readAll<WeekRow>('usage_weeks', `select=*&week=in.(${pilotWeeks.join(',')})`),
    ])
    return json(200, { ...computeMetrics(start, visits, weeks, platform), pilotStart: process.env.PILOT_START ?? null })
  } catch (error) {
    console.error('Could not read the pilot data', error)
    return json(502, { error: 'database' })
  }
}
