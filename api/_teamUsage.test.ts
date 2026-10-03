import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST, toVisitRow } from './team-usage'
import { POST as feedbackPost } from './feedback'

const visit = {
  v: 3, day: '2026-10-05', seconds: 60, cohort_week: '2026-W41', week_since_first: 0, first_ever: true, first_of_day: true,
  first_of_week: true, first_of_life_week: true, continued: false, platform: 'ios', checkins: 1, from_reminder: false, reminder_on: true,
}
const routine = { v: 3, kind: 'routine', week: '2026-W41', sessions: [{ day: 1, kind: 'training', start: '18:00', end: '20:00' }], platform: 'ios' }

describe('team pilots', () => {
  const calls: { url: string; body: unknown }[] = []
  beforeEach(() => {
    calls.length = 0
    vi.stubEnv('SUPABASE_URL', 'https://main.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_main')
    vi.stubEnv('VEROVOLLEY_SUPABASE_URL', 'https://vero.test')
    vi.stubEnv('VEROVOLLEY_SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_vero')
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null })
      return new Response(null, { status: 201 })
    }))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('stores a team phone\'s visits and routines in the team\'s own database', async () => {
    const response = await POST(new Request('https://app.test/api/team-usage?team=verovolley', { method: 'POST', body: JSON.stringify([visit, routine, { v: 3, kind: 'week' }]) }))
    expect(response.status).toBe(204)
    expect(calls.map((c) => c.url)).toEqual(['https://vero.test/rest/v1/usage_visits', 'https://vero.test/rest/v1/usage_routines'])
    expect(calls[0].body).toEqual([{ ...Object.fromEntries(Object.entries(visit).filter(([k]) => k !== 'v')) }])
  })

  it('refuses an unknown or missing team, and waits (5xx) while the team database is not set up', async () => {
    const post = (url: string) => POST(new Request(url, { method: 'POST', body: JSON.stringify([visit]) }))
    expect((await post('https://app.test/api/team-usage')).status).toBe(400)
    expect((await post('https://app.test/api/team-usage?team=other')).status).toBe(400)
    vi.stubEnv('VEROVOLLEY_SUPABASE_URL', '')
    expect((await post('https://app.test/api/team-usage?team=verovolley')).status).toBe(503)
    expect(calls).toEqual([])
  })

  it('sends a team phone\'s feedback to the team database, everyone else\'s to the main one', async () => {
    const send = (url: string) => feedbackPost(new Request(url, { method: 'POST', body: JSON.stringify({ kind: 'idea', message: 'ok' }) }))
    await send('https://app.test/api/feedback?team=verovolley')
    await send('https://app.test/api/feedback')
    expect(calls.map((c) => c.url)).toEqual(['https://vero.test/rest/v1/feedback', 'https://main.test/rest/v1/feedback'])
  })

  it('checks visit rows like the main endpoint', () => {
    expect(toVisitRow({ ...visit, seconds: 99_999 })?.seconds).toBe(10_800)
    expect(toVisitRow({ ...visit, name: 'Giulia' })).not.toHaveProperty('name')
    expect(toVisitRow({ ...visit, v: 2 })).toBeNull()
  })
})
