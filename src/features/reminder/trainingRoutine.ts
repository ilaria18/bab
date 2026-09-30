import { safeStorage } from '@/shared/lib/safeStorage'

/**
 * The athlete's weekly routine of training sessions and matches (optional, entered in Settings).
 * On a day with a session she gets a notification 3 hours before it and one 2 hours after it,
 * instead of the daily reminder. With no routine entered, only the daily reminder is sent.
 * Stored on the phone only; the server just receives the resulting notification times.
 */

export type SessionKind = 'training' | 'match'

/** ISO weekday: 1 = Monday … 7 = Sunday */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Session = { day: IsoWeekday; kind: SessionKind; start: string; end: string } // 'HH:MM', local time

export type SlotType = 'pre_training' | 'post_training' | 'pre_match' | 'post_match'

/** One weekly notification: day of the week, local time, which message. */
export type ReminderSlot = { dow: IsoWeekday; time: string; type: SlotType }

export const PRE_SESSION_MINUTES = 3 * 60
export const POST_SESSION_MINUTES = 2 * 60
export const MAX_SESSIONS = 14

const STORAGE_KEY = 'training-routine'
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const WEEK_MINUTES = 7 * 24 * 60

const isSession = (value: unknown): value is Session => {
  const s = value as Partial<Session> | null
  return (
    !!s &&
    Number.isInteger(s.day) &&
    (s.day as number) >= 1 &&
    (s.day as number) <= 7 &&
    (s.kind === 'training' || s.kind === 'match') &&
    typeof s.start === 'string' &&
    TIME.test(s.start) &&
    typeof s.end === 'string' &&
    TIME.test(s.end)
  )
}

export const getTrainingRoutine = (): Session[] => {
  try {
    const stored = JSON.parse(safeStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    return Array.isArray(stored) ? stored.filter(isSession).slice(0, MAX_SESSIONS) : []
  } catch {
    return []
  }
}

export const saveTrainingRoutine = (sessions: Session[]): void =>
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

const fromMinuteOfWeek = (minuteOfWeek: number): { dow: IsoWeekday; time: string } => {
  const m = ((minuteOfWeek % WEEK_MINUTES) + WEEK_MINUTES) % WEEK_MINUTES
  const dow = (Math.floor(m / 1440) + 1) as IsoWeekday
  const minutes = m % 1440
  return { dow, time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}` }
}

/**
 * The notifications a routine produces: 3 hours before each session starts and 2 hours after it
 * ends (an end earlier than the start means it finishes after midnight). A session early in the
 * morning can move its "before" notification to the evening of the previous day.
 * `sessionDays` are the days that get these instead of the daily reminder.
 */
export const routineSlots = (sessions: Session[]): { slots: ReminderSlot[]; sessionDays: IsoWeekday[] } => {
  const seen = new Set<string>()
  const slots: ReminderSlot[] = []
  const add = (slot: ReminderSlot) => {
    const key = `${slot.dow} ${slot.time} ${slot.type}`
    if (seen.has(key)) return
    seen.add(key)
    slots.push(slot)
  }
  for (const session of sessions) {
    const start = (session.day - 1) * 1440 + toMinutes(session.start)
    const duration = (toMinutes(session.end) - toMinutes(session.start) + 1440) % 1440
    add({ ...fromMinuteOfWeek(start - PRE_SESSION_MINUTES), type: `pre_${session.kind}` })
    add({ ...fromMinuteOfWeek(start + duration + POST_SESSION_MINUTES), type: `post_${session.kind}` })
  }
  slots.sort((a, b) => a.dow - b.dow || a.time.localeCompare(b.time))
  const sessionDays = [...new Set(sessions.map((s) => s.day))].sort((a, b) => a - b)
  return { slots, sessionDays }
}
