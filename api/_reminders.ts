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

export const SLOT_TYPES = ['pre_training', 'post_training', 'pre_match', 'post_match'] as const
export type SlotType = (typeof SLOT_TYPES)[number]
/** a weekly training/match notification: ISO weekday (1 = Monday), local time, which text */
export type Slot = { dow: number; time: string; type: SlotType }
export type Text = { title: string; body: string }

export type ReminderRow = {
  endpoint: string
  p256dh: string
  auth: string
  remind_at: string
  time_zone: string
  title: string
  body: string
  last_sent_day: string | null
  /** weekly training/match routine: empty/null = daily reminder only */
  slots?: Slot[] | null
  session_days?: number[] | null
  texts?: Partial<Record<SlotType, Text>> | null
  /** what was already sent today, e.g. "2026-10-05 15:00 pre_training", "2026-10-05 daily" */
  sent_keys?: string[] | null
}

export const MAX_SLOTS = 60

export const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** local day (YYYY-MM-DD), ISO weekday and minutes since midnight in a time zone */
export const localNow = (timeZone: string, now: Date): { day: string; dow: number; minutes: number } => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
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
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    dow: WEEKDAYS[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

const minutesOf = (time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

const inWindow = (nowMinutes: number, time: string) => {
  const late = nowMinutes - minutesOf(time)
  return late >= 0 && late < WINDOW_MINUTES
}

export type DueReminder = { key: string; title: string; body: string }

/**
 * Everything to send now for one phone. On a day with a training or match: the notifications
 * 3 hours before / 2 hours after it; on any other day: the daily reminder. Each goes out once
 * (sent_keys), at the first run of the scheduler from its time on, within an hour.
 */
export const dueReminders = (row: ReminderRow, now: Date): { day: string; due: DueReminder[] } => {
  const { day, dow, minutes } = localNow(row.time_zone, now)
  const sent = new Set((row.sent_keys ?? []).filter((key) => key.startsWith(day)))
  if (row.last_sent_day === day) sent.add(`${day} daily`)
  const due: DueReminder[] = []

  for (const slot of row.slots ?? []) {
    const key = `${day} ${slot.time} ${slot.type}`
    const text = row.texts?.[slot.type]
    if (slot.dow === dow && !sent.has(key) && inWindow(minutes, slot.time)) {
      due.push({ key, title: text?.title ?? row.title, body: text?.body ?? row.body })
    }
  }
  const sessionDay = (row.session_days ?? []).includes(dow)
  if (!sessionDay && !sent.has(`${day} daily`) && inWindow(minutes, row.remind_at)) {
    due.push({ key: `${day} daily`, title: row.title, body: row.body })
  }
  return { day, due }
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

/**
 * What of a database error may go to the logs: the status and Supabase's error code and message,
 * never its "details" or "hint", which can repeat the refused row (health data, notes, feedback).
 */
export const dbError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { code?: unknown; message?: unknown }
    const message = typeof body.message === 'string' ? body.message.replace(/\(.*\)/g, '(…)').slice(0, 200) : ''
    return `${response.status} ${typeof body.code === 'string' ? body.code : ''} ${message}`.trim()
  } catch {
    return String(response.status)
  }
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
