import type { CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { createId } from '@/shared/lib/createId'
import { safeStorage } from '@/shared/lib/safeStorage'
import type { Session } from '@/features/reminder/trainingRoutine'

/**
 * The athlete's own check-ins, sent to the BAB research database (api/research.ts) only when she
 * taps "Send my data" and confirms. Nothing leaves the phone otherwise.
 * No name is sent: the rows carry a random participant code, the same for every send from this
 * phone, and a secret token that only this phone has — so only this phone can replace or delete
 * the data it sent. Words and body areas travel as their English ids, the same for every athlete.
 * With them goes her weekly training/match routine (weekday, kind, start, end — as entered in
 * Settings), so check-ins can be compared with the training load.
 */

/** bump when the consent text shown before sending changes */
export const CONSENT_VERSION = '2026-10-v2'
export const RESEARCH_API = '/api/research'

const CODE_KEY = 'participant-code'
const TOKEN_KEY = 'research-token'
const SENT_KEY = 'research-sent-at'
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O, 1/I: easy to read aloud

/** A short random code for this phone (created once), e.g. "K7QH3M". */
export const participantCode = (): string => {
  const saved = safeStorage.getItem(CODE_KEY)
  if (saved) return saved
  const hex = createId().replace(/-/g, '')
  const code = Array.from({ length: 6 }, (_, i) => CODE_CHARS[parseInt(hex.slice(i * 2, i * 2 + 2), 16) % CODE_CHARS.length]).join('')
  safeStorage.setItem(CODE_KEY, code)
  return code
}

/** The secret that proves a send comes from this phone (created once, never shown). */
const participantToken = (): string => {
  const saved = safeStorage.getItem(TOKEN_KEY)
  if (saved) return saved
  const token = `${createId()}${createId()}`.replace(/-/g, '')
  safeStorage.setItem(TOKEN_KEY, token)
  return token
}

export const lastSentAt = (): string | null => safeStorage.getItem(SENT_KEY) || null

export type ResearchRow = {
  record_id: string
  record: 'check-in' | 'day'
  date: string
  time: string | null
  word_id: string | null
  word: string | null
  category: string | null
  intensity: number | null
  energy: number | null
  triggers: string[]
  body_zones: string[]
  on_period: boolean | null
  took_painkiller: boolean | null
  note: string | null
}

const localTime = (iso: string): string | null => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? null
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * One row per check-in (with that day's period/painkiller answers), plus one "day" row for each
 * day with period/painkiller answers but no check-in. Oldest first.
 */
export const buildRows = (
  entries: CheckInEntry[],
  logs: DailyLog[],
  words: Map<string, { word: string; category: string }>,
): ResearchRow[] => {
  const logByDate = new Map(logs.map((log) => [log.date, log]))
  const rows: (ResearchRow & { sortKey: string })[] = entries.map((entry) => {
    const log = logByDate.get(entry.date)
    const word = words.get(entry.wordId)
    return {
      sortKey: `${entry.date} ${entry.createdAt}`,
      record_id: entry.id,
      record: 'check-in',
      date: entry.date,
      time: localTime(entry.createdAt),
      word_id: entry.wordId,
      word: word?.word ?? null,
      category: word?.category ?? null,
      intensity: entry.intensity,
      energy: entry.energy ?? null,
      triggers: entry.triggers ?? [],
      body_zones: entry.bodyZones,
      on_period: log?.hadPeriod ?? null,
      took_painkiller: log?.tookPainkiller ?? null,
      note: entry.note?.trim() ? entry.note : null,
    }
  })
  const datesWithCheckIns = new Set(entries.map((entry) => entry.date))
  for (const log of logs) {
    if (datesWithCheckIns.has(log.date) || (log.hadPeriod === null && log.tookPainkiller === null)) continue
    rows.push({
      sortKey: log.date,
      record_id: `day-${log.date}`,
      record: 'day',
      date: log.date,
      time: null,
      word_id: null,
      word: null,
      category: null,
      intensity: null,
      energy: null,
      triggers: [],
      body_zones: [],
      on_period: log.hadPeriod,
      took_painkiller: log.tookPainkiller,
      note: null,
    })
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  return rows.map(({ sortKey: _omit, ...row }) => row)
}

/** Sends everything; what this phone sent before is replaced (so deleted check-ins go too). */
export const sendResearchData = async (rows: ResearchRow[], routine: Session[] = []): Promise<void> => {
  const response = await fetch(RESEARCH_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: participantCode(), token: participantToken(), consentVersion: CONSENT_VERSION, rows, routine }),
    credentials: 'omit',
  })
  if (!response.ok) throw new Error(`research upload: ${response.status}`)
  safeStorage.setItem(SENT_KEY, new Date().toISOString())
}

/** Deletes from the database everything this phone sent (the check-ins stay on the phone). */
export const deleteResearchData = async (): Promise<void> => {
  const response = await fetch(RESEARCH_API, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: participantCode(), token: participantToken() }),
    credentials: 'omit',
  })
  if (!response.ok) throw new Error(`research delete: ${response.status}`)
  safeStorage.setItem(SENT_KEY, '')
}
