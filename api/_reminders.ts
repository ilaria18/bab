/// <reference types="node" />
/**
 * Shared by api/reminder.ts and api/send-reminders.ts: the Supabase table of web-app reminders
 * and the rule that decides when each one is due.
 * (Files in api/ starting with "_" are not deployed as endpoints.)
 */

export const TABLE = 'push_subscriptions'
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
/** a reminder is sent at the first run of the scheduler from its time up to this many minutes later */
export const WINDOW_MINUTES = 60

export type ReminderRow = {
  endpoint: string
  p256dh: string
  auth: string
  remind_at: string
  time_zone: string
  title: string
  body: string
  last_sent_day: string | null
}

export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** local day (YYYY-MM-DD) and minutes since midnight in a time zone */
export const localNow = (timeZone: string, now: Date): { day: string; minutes: number } => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

/** The local day to record as sent, or null if this reminder is not due now. */
export const dueDay = (row: Pick<ReminderRow, 'remind_at' | 'time_zone' | 'last_sent_day'>, now: Date): string | null => {
  const { day, minutes } = localNow(row.time_zone, now)
  if (row.last_sent_day === day) return null
  const [hour, minute] = row.remind_at.split(':').map(Number)
  const late = minutes - (hour * 60 + minute)
  return late >= 0 && late < WINDOW_MINUTES ? day : null
}

export const supabase = (path: string, init: RequestInit = {}) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': 'application/json',
      'User-Agent': 'bab-reminder-endpoint/1.0',
      ...init.headers,
    },
  })
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
