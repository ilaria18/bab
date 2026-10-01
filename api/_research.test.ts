import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { DELETE, POST, toResearchRow, toRoutine } from './research'

const TOKEN = 'a'.repeat(64)
const row = {
  record_id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  record: 'check-in',
  date: '2026-10-05',
  time: '18:30',
  word_id: 'tight',
  word: 'Tight',
  category: 'muscle',
  intensity: 6,
  energy: 3,
  triggers: ['movement'],
  body_zones: ['kneeLeft', 'kneeLeftBack'],
  on_period: true,
  took_painkiller: false,
  note: 'after sprints',
}

describe('research rows', () => {
  it('keeps only known, valid fields', () => {
    expect(toResearchRow('K7QH3M', { ...row, name: 'Giulia' })).toEqual({ participant: 'K7QH3M', ...row })
    expect(toResearchRow('K7QH3M', { ...row, intensity: 11 })).toBeNull()
    expect(toResearchRow('K7QH3M', { ...row, triggers: ['sleep'] })).toBeNull()
    expect(toResearchRow('K7QH3M', { ...row, body_zones: ['<script>'] })).toBeNull()
    expect(toResearchRow('K7QH3M', { ...row, note: 'x'.repeat(2001) })).toBeNull()
  })
})

describe('routine', () => {
  it('keeps weekday, kind and times only; refuses anything else', () => {
    const session = { day: 1, kind: 'training', start: '18:00', end: '20:00' }
    expect(toRoutine(undefined)).toEqual([])
    expect(toRoutine([{ ...session, place: 'gym' }])).toEqual([session])
    expect(toRoutine([{ ...session, day: 8 }])).toBeNull()
    expect(toRoutine([{ ...session, kind: 'party' }])).toBeNull()
    expect(toRoutine(Array.from({ length: 15 }, () => session))).toBeNull()
  })
})

describe('research endpoint', () => {
  const calls: { url: string; init?: RequestInit }[] = []
  let existingHash: string | null = null

  beforeEach(() => {
    calls.length = 0
    existingHash = null
    vi.stubEnv('SUPABASE_URL', 'https://db.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_x')
    vi.stubEnv('RESEARCH_UPLOAD', 'on')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        if (url.includes('select=token_hash')) return Response.json(existingHash ? [{ token_hash: existingHash }] : [])
        return new Response(null, { status: 201 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const post = (body: unknown) => POST(new Request('https://app.test/api/research', { method: 'POST', body: JSON.stringify(body) }))
  const del = (body: unknown) => DELETE(new Request('https://app.test/api/research', { method: 'DELETE', body: JSON.stringify(body) }))
  const valid = { code: 'K7QH3M', token: TOKEN, consentVersion: '2026-10-v1', rows: [row] }

  it('refuses sends while the research upload is closed, but still lets a phone delete', async () => {
    vi.stubEnv('RESEARCH_UPLOAD', '')
    expect((await post(valid)).status).toBe(403)
    expect(calls).toEqual([])
    existingHash = createHash('sha256').update(TOKEN).digest('hex')
    expect((await del({ code: 'K7QH3M', token: TOKEN })).status).toBe(200)
  })

  it('stores the routine sent with the data', async () => {
    const routine = [{ day: 6, kind: 'match', start: '17:00', end: '19:00' }]
    expect((await post({ ...valid, routine })).status).toBe(200)
    expect(JSON.parse(String(calls[1].init?.body)).routine).toEqual(routine)
    expect((await post({ ...valid, routine: [{ day: 6 }] })).status).toBe(400)
  })

  it('stores a first send: participant with the token hash, then the rows', async () => {
    expect((await post(valid)).status).toBe(200)
    const participant = JSON.parse(String(calls[1].init?.body))
    expect(participant).toMatchObject({ code: 'K7QH3M', consent_version: '2026-10-v1', routine: [] })
    expect(participant.token_hash).toBe(createHash('sha256').update(TOKEN).digest('hex'))
    expect(JSON.stringify(participant)).not.toContain(TOKEN)
    expect(calls[2]).toMatchObject({ url: 'https://db.test/rest/v1/research_checkins?participant=eq.K7QH3M', init: { method: 'DELETE' } })
    expect(JSON.parse(String(calls[3].init?.body))).toEqual([{ participant: 'K7QH3M', ...row }])
  })

  it('refuses a send or a delete with someone else’s code', async () => {
    existingHash = createHash('sha256').update('b'.repeat(64)).digest('hex')
    expect((await post(valid)).status).toBe(403)
    expect((await del({ code: 'K7QH3M', token: TOKEN })).status).toBe(403)
    expect(calls.every((c) => !c.init?.method || c.init.method === 'GET')).toBe(true)
  })

  it('lets the same phone delete everything it sent', async () => {
    existingHash = createHash('sha256').update(TOKEN).digest('hex')
    expect((await del({ code: 'K7QH3M', token: TOKEN })).status).toBe(200)
    expect(calls[1]).toMatchObject({ url: 'https://db.test/rest/v1/research_participants?code=eq.K7QH3M', init: { method: 'DELETE' } })
  })

  it('rejects malformed requests', async () => {
    expect((await post({ ...valid, code: 'k7qh3m' })).status).toBe(400)
    expect((await post({ ...valid, token: 'short' })).status).toBe(400)
    expect((await post({ ...valid, rows: [] })).status).toBe(400)
    expect((await post({ ...valid, rows: [{ ...row, date: 'yesterday' }] })).status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})
