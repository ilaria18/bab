/// <reference types="node" />
import { timingSafeEqual } from 'node:crypto'
import { dueReminders, json, supabase, TABLE, type ReminderRow } from './_reminders.js'
import { sendPush, type VapidKeys } from './_webpush.js'

/**
 * Sends the web app's reminders that are due: the daily one, or on training/match days the
 * notifications 3 hours before and 2 hours after the session. Called every 5 minutes by a scheduled job
 * in Supabase (analytics/setup.sql) with  Authorization: Bearer <CRON_SECRET>.
 * Each reminder goes out once a day, at the first call from its time on (within an hour).
 *
 * Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:info@babsport.com).
 */

const STALE_DAYS = 60
/** enough to decide whether anything is due (see dueReminders) */
const WHEN_COLUMNS = 'endpoint,remind_at,time_zone,last_sent_day,slots,session_days,sent_keys'

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

  // Runs every 5 minutes: first only the columns that say *when* (no keys, no texts), then the
  // full rows of the few phones with something due. Keeps the database's outgoing traffic small.
  const now = new Date()
  const light = await supabase(`${TABLE}?select=${WHEN_COLUMNS}`)
  if (!light.ok) {
    console.error('Could not read the reminders', light.status, await light.text())
    return json(502, { error: 'database' })
  }
  const checked = (await light.json()) as ReminderRow[]
  const dueEndpoints = checked.filter((row) => dueReminders(row, now).due.length > 0).map((row) => row.endpoint)
  const rows: ReminderRow[] = []
  for (let i = 0; i < dueEndpoints.length; i += 20) {
    const list = dueEndpoints.slice(i, i + 20).map((e) => `"${e.replace(/"/g, '')}"`).join(',')
    const full = await supabase(`${TABLE}?select=*&endpoint=in.(${encodeURIComponent(list)})`)
    if (!full.ok) {
      console.error('Could not read the due reminders', full.status, await full.text())
      return json(502, { error: 'database' })
    }
    rows.push(...((await full.json()) as ReminderRow[]))
  }
  const byEndpoint = (row: ReminderRow) => `${TABLE}?endpoint=eq.${encodeURIComponent(row.endpoint)}`

  let sent = 0
  let removed = 0
  let failed = 0
  await Promise.all(
    rows.map(async (row) => {
      const { day, due } = dueReminders(row, now)
      if (due.length === 0) return
      const delivered: string[] = []
      for (const reminder of due) {
        try {
          const status = await sendPush(row, { title: reminder.title, body: reminder.body }, keys)
          if (status === 404 || status === 410) {
            removed += 1
            await supabase(byEndpoint(row), { method: 'DELETE' })
            return
          }
          if (status >= 200 && status < 300) {
            sent += 1
            delivered.push(reminder.key)
          } else {
            failed += 1
            console.error('Push service refused a reminder', status, new URL(row.endpoint).hostname)
          }
        } catch (error) {
          failed += 1
          console.error('Could not send a reminder', error)
        }
      }
      if (delivered.length === 0) return
      // only today's keys are kept: yesterday's can never match again
      const sentKeys = [...(row.sent_keys ?? []).filter((key) => key.startsWith(day)), ...delivered]
      const patch: Record<string, unknown> = { sent_keys: sentKeys }
      if (delivered.includes(`${day} daily`)) patch.last_sent_day = day
      await supabase(byEndpoint(row), { method: 'PATCH', body: JSON.stringify(patch) })
    }),
  )
  return json(200, { checked: checked.length, due: rows.length, sent, removed, failed })
}

export const GET = run
export const POST = run
