import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createECDH } from 'node:crypto'
import { dueReminders, localNow, type ReminderRow } from './_reminders'
import { b64u } from './_webpush'
import { PUT } from './reminder'
import { POST as sendReminders } from './send-reminders'

const at = (iso: string) => new Date(iso)
const row = (remind_at: string, extra: Partial<ReminderRow> = {}): ReminderRow => ({
  endpoint: 'https://web.push.apple.com/x', p256dh: '', auth: '', remind_at, time_zone: 'Europe/Rome',
  title: 'BAB', body: 'Daily', last_sent_day: null, ...extra,
})
const keysDue = (r: ReminderRow, iso: string) => dueReminders(r, at(iso)).due.map((d) => d.key)

describe('reminder schedule', () => {
  it('reads the local day, weekday and time in the athlete’s time zone', () => {
    expect(localNow('Europe/Rome', at('2026-10-05T17:03:00Z'))).toEqual({ day: '2026-10-05', dow: 1, minutes: 19 * 60 + 3 })
    expect(localNow('America/New_York', at('2026-10-06T01:00:00Z'))).toEqual({ day: '2026-10-05', dow: 1, minutes: 21 * 60 })
  })

  it('sends the daily reminder from its time for an hour, once a day', () => {
    expect(keysDue(row('19:00'), '2026-10-05T16:58:00Z')).toEqual([]) // 18:58 in Rome
    expect(keysDue(row('19:00'), '2026-10-05T17:00:00Z')).toEqual(['2026-10-05 daily'])
    expect(keysDue(row('19:00'), '2026-10-05T17:55:00Z')).toEqual(['2026-10-05 daily'])
    expect(keysDue(row('19:00'), '2026-10-05T18:00:00Z')).toEqual([]) // too late, skip today
    expect(keysDue(row('19:00', { last_sent_day: '2026-10-05' }), '2026-10-05T17:05:00Z')).toEqual([])
    expect(keysDue(row('19:00', { sent_keys: ['2026-10-05 daily'] }), '2026-10-05T17:05:00Z')).toEqual([])
    expect(keysDue(row('19:00', { sent_keys: ['2026-10-04 daily'] }), '2026-10-05T17:05:00Z')).toEqual(['2026-10-05 daily'])
  })

  it('on a training day sends 3 h before and 2 h after instead of the daily reminder', () => {
    // Monday training 18:00-20:00 → 15:00 before, 22:00 after
    const r = row('19:00', {
      slots: [
        { dow: 1, time: '15:00', type: 'pre_training' },
        { dow: 1, time: '22:00', type: 'post_training' },
      ],
      session_days: [1],
      texts: { pre_training: { title: 'BAB', body: 'Before' } },
    })
    expect(dueReminders(r, at('2026-10-05T13:02:00Z')).due).toEqual([
      { key: '2026-10-05 15:00 pre_training', title: 'BAB', body: 'Before' },
    ])
    expect(keysDue(r, '2026-10-05T17:05:00Z')).toEqual([]) // no daily reminder on a training day
    expect(keysDue(r, '2026-10-05T20:01:00Z')).toEqual(['2026-10-05 22:00 post_training'])
    expect(keysDue({ ...r, sent_keys: ['2026-10-05 22:00 post_training'] }, '2026-10-05T20:10:00Z')).toEqual([])
    // Tuesday: no session, the daily reminder as before
    expect(keysDue(r, '2026-10-06T17:01:00Z')).toEqual(['2026-10-06 daily'])
  })
})

describe('reminder endpoints', () => {
  const calls: { url: string; init?: RequestInit }[] = []
  const phone = createECDH('prime256v1')
  phone.generateKeys()
  const server = createECDH('prime256v1')
  server.generateKeys()
  const subscription = {
    endpoint: 'https://web.push.apple.com/QGuQyavXutnMH',
    keys: { p256dh: b64u.encode(phone.getPublicKey()), auth: b64u.encode(Buffer.alloc(16, 1)) },
  }

  beforeEach(() => {
    calls.length = 0
    vi.stubEnv('SUPABASE_URL', 'https://db.test')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_x')
    vi.stubEnv('VAPID_PUBLIC_KEY', b64u.encode(server.getPublicKey()))
    vi.stubEnv('VAPID_PRIVATE_KEY', b64u.encode(server.getPrivateKey()))
    vi.stubEnv('CRON_SECRET', 'cron-secret')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('saves a reminder and refuses anything that is not a real push subscription', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => (calls.push({ url, init }), new Response(null, { status: 201 }))))
    const put = (body: unknown) => PUT(new Request('https://app.test/api/reminder', { method: 'PUT', body: JSON.stringify(body) }))
    const valid = { subscription, time: '19:00', timeZone: 'Europe/Rome', title: 'BAB', body: 'Com’è andata oggi?' }

    expect((await put(valid)).status).toBe(200)
    expect(calls[0].url).toBe('https://db.test/rest/v1/push_subscriptions?on_conflict=endpoint')
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ endpoint: subscription.endpoint, remind_at: '19:00', time_zone: 'Europe/Rome' })

    expect((await put({ ...valid, subscription: { ...subscription, endpoint: 'https://evil.test/x' } })).status).toBe(400)
    expect((await put({ ...valid, time: '25:00' })).status).toBe(400)
    expect((await put({ ...valid, timeZone: 'Mars/Base' })).status).toBe(400)
    expect((await put({ ...valid, slots: [{ dow: 8, time: '15:00', type: 'pre_training' }] })).status).toBe(400)
    expect((await put({ ...valid, slots: [{ dow: 1, time: '15:00', type: 'lunch' }] })).status).toBe(400)
    expect(calls).toHaveLength(1)

    // with a routine
    const routine = {
      ...valid,
      slots: [{ dow: 1, time: '15:00', type: 'pre_training' }],
      sessionDays: [1],
      texts: { pre_training: { title: 'BAB', body: 'Before' } },
    }
    expect((await put(routine)).status).toBe(200)
    expect(JSON.parse(String(calls[1].init?.body))).toMatchObject({
      slots: [{ dow: 1, time: '15:00', type: 'pre_training' }],
      session_days: [1],
      texts: { pre_training: { title: 'BAB', body: 'Before' } },
    })
  })

  it('sends the reminders that are due, and forgets phones that are gone', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(at('2026-10-05T17:02:00Z')) // 19:02 in Rome
    const rows = [
      { endpoint: 'https://web.push.apple.com/due', p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, remind_at: '19:00', time_zone: 'Europe/Rome', title: 'BAB', body: 'Ciao', last_sent_day: null },
      { endpoint: 'https://fcm.googleapis.com/fcm/send/gone', p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, remind_at: '19:00', time_zone: 'Europe/Rome', title: 'BAB', body: 'Ciao', last_sent_day: null },
      { endpoint: 'https://fcm.googleapis.com/fcm/send/later', p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, remind_at: '21:00', time_zone: 'Europe/Rome', title: 'BAB', body: 'Ciao', last_sent_day: null },
    ]
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.includes('select=*')) return Response.json(rows)
      if (url.endsWith('/gone')) return new Response(null, { status: 410 })
      return new Response(null, { status: 201 })
    }))

    expect((await sendReminders(new Request('https://app.test/api/send-reminders', { method: 'POST' }))).status).toBe(401)
    const response = await sendReminders(
      new Request('https://app.test/api/send-reminders', { method: 'POST', headers: { Authorization: 'Bearer cron-secret' } }),
    )
    expect(await response.json()).toEqual({ checked: 3, sent: 1, removed: 1, failed: 0 })

    const pushed = calls.find((c) => c.url === 'https://web.push.apple.com/due')!
    expect((pushed.init?.headers as Record<string, string>)['Content-Encoding']).toBe('aes128gcm')
    expect((pushed.init?.headers as Record<string, string>).Authorization).toMatch(/^vapid t=.+, k=/)
    expect(calls.some((c) => c.url.includes('/later'))).toBe(false)
    const marked = calls.find((c) => c.init?.method === 'PATCH')!
    expect(JSON.parse(String(marked.init?.body))).toEqual({ last_sent_day: '2026-10-05', sent_keys: ['2026-10-05 daily'] })
    expect(calls.some((c) => c.init?.method === 'DELETE' && c.url.includes(encodeURIComponent('/gone')))).toBe(true)
  })
})
