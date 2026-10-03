/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto'
import { databaseConfigured, dbError, json, supabaseFor, teamOf, type Team } from './_reminders.js'
import { computeResearchMetrics, type ParticipantRow, type ResearchCheckinRow } from './_researchMetrics.js'

/**
 * First analyses of the check-ins athletes sent, for the dashboard's "Check-ins" tab.
 *
 * GET /api/research-metrics?start=YYYY-MM-DD   (optional: only the 35 pilot days from start)
 *     &team=volleybergamo                           (optional: that team's own database)
 * Header: Authorization: Bearer <DASHBOARD_PASSWORD>
 *
 * Reads research_checkins and the routines in research_participants with the server's secret key
 * and returns aggregates only: the rows, the notes and the participant codes never leave this function.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/
const PAGE = 1000
const COLUMNS = 'participant,record,date,time,word_id,word,category,intensity,energy,triggers,body_zones,on_period,took_painkiller'

const passwordMatches = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

const readRows = async (team: Team | null): Promise<ResearchCheckinRow[]> => {
  const rows: ResearchCheckinRow[] = []
  for (let from = 0; ; from += PAGE) {
    const response = await supabaseFor(team)(`research_checkins?select=${COLUMNS}&order=date`, {
      headers: { 'Range-Unit': 'items', Range: `${from}-${from + PAGE - 1}` },
    })
    if (!response.ok) throw new Error(`research_checkins: ${await dbError(response)}`)
    const page = (await response.json()) as ResearchCheckinRow[]
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

const readParticipants = async (team: Team | null): Promise<ParticipantRow[]> => {
  const response = await supabaseFor(team)('research_participants?select=code,routine')
  if (!response.ok) throw new Error(`research_participants: ${await dbError(response)}`)
  return (await response.json()) as ParticipantRow[]
}

export async function GET(request: Request): Promise<Response> {
  const expected = process.env.DASHBOARD_PASSWORD
  const team = teamOf(request)
  if (team === 'invalid') return json(400, { error: 'unknown_team' })
  if (!expected || !databaseConfigured(team)) {
    return json(503, { error: 'not_configured' })
  }
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!passwordMatches(given, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 800)) // slows down guessing
    return json(401, { error: 'wrong_password' })
  }
  const start = new URL(request.url).searchParams.get('start')
  const range =
    start && DAY.test(start)
      ? { from: start, to: new Date(Date.parse(`${start}T00:00:00Z`) + 34 * 86_400_000).toISOString().slice(0, 10) }
      : undefined
  try {
    const [rows, participants] = await Promise.all([readRows(team), readParticipants(team)])
    return json(200, computeResearchMetrics(rows, participants, range))
  } catch (error) {
    console.error('Could not read the research data', error)
    return json(502, { error: 'database' })
  }
}
