/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto'
import { dueDay, json, supabase, TABLE, type ReminderRow } from './_reminders.js'
import { sendPush, type VapidKeys } from './_webpush.js'

/**
 * Sends the web app's daily reminders that are due. Called every 5 minutes by a scheduled job
 * in Supabase (analytics/reminder-cron.sql) with  Authorization: Bearer <CRON_SECRET>.
 * Each reminder goes out once a day, at the first call from its time on (within an hour).
 *
 * Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:info@babsport.com).
 */

const STALE_DAYS = 60

const authorized = (request: Request) => {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const given = Buffer.from((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  const wanted = Buffer.from(expected)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

const run = async (request: Request): Promise<Response> => {
  if (!authorized(request)) return json(401, { error: 'unauthorized' })
  const keys: VapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    privateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    subject: process.env.VAPID_SUBJECT ?? 'mailto:info@babsport.com',
  }
  if (!keys.publicKey || !keys.privateKey || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: 'not_configured' })
  }

  // phones that haven't opened the app for two months: forget them
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString()
  await supabase(`${TABLE}?updated_at=lt.${cutoff}`, { method: 'DELETE' })

  const response = await supabase(`${TABLE}?select=*`)
  if (!response.ok) {
    console.error('Could not read the reminders', response.status, await response.text())
    return json(502, { error: 'database' })
  }
  const rows = (await response.json()) as ReminderRow[]
  const now = new Date()
  const byEndpoint = (row: ReminderRow) => `${TABLE}?endpoint=eq.${encodeURIComponent(row.endpoint)}`

  let sent = 0
  let removed = 0
  let failed = 0
  await Promise.all(
    rows.map(async (row) => {
      const day = dueDay(row, now)
      if (!day) return
      try {
        const status = await sendPush(row, { title: row.title, body: row.body }, keys)
        if (status === 404 || status === 410) {
          removed += 1
          await supabase(byEndpoint(row), { method: 'DELETE' })
        } else if (status >= 200 && status < 300) {
          sent += 1
          await supabase(byEndpoint(row), { method: 'PATCH', body: JSON.stringify({ last_sent_day: day }) })
        } else {
          failed += 1
          console.error('Push service refused a reminder', status, new URL(row.endpoint).hostname)
        }
      } catch (error) {
        failed += 1
        console.error('Could not send a reminder', error)
      }
    }),
  )
  return json(200, { checked: rows.length, sent, removed, failed })
}

export const GET = run
export const POST = run
