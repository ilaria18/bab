import type { CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { createId } from '@/shared/lib/createId'
import { safeStorage } from '@/shared/lib/safeStorage'

/**
 * The athlete's own data as one CSV file, created only when she taps "Send my data" and sent
 * wherever she chooses (the phone's share menu: WhatsApp, email…). Nothing leaves the phone
 * otherwise. The file has no name in it: rows carry a random participant code instead, the same
 * for every export from this phone, so two files from the same athlete can be recognised.
 * Words and body areas are written as their English ids, the same for every athlete whatever
 * language her app is in.
 */

const CODE_KEY = 'participant-code'
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

export const CSV_COLUMNS = [
  'participant',
  'record',
  'date',
  'time',
  'word_id',
  'word',
  'category',
  'intensity_0_10',
  'energy_1_7',
  'triggers',
  'body_zones',
  'on_period',
  'took_painkiller',
  'note',
] as const

/** Excel (in Italian too) opens this directly: ";" between columns, UTF-8 with a BOM. */
const SEPARATOR = ';'
const cell = (value: string | number | boolean | null | undefined): string => {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const localTime = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * One row per check-in (with that day's period/painkiller answers), plus one "day" row for each
 * day that has period/painkiller answers but no check-in. Oldest first.
 */
export const buildCsv = (
  code: string,
  entries: CheckInEntry[],
  logs: DailyLog[],
  words: Map<string, { word: string; category: string }>,
): string => {
  const logByDate = new Map(logs.map((log) => [log.date, log]))
  const rows: { sortKey: string; values: (string | number | boolean | null | undefined)[] }[] = []

  for (const entry of entries) {
    const log = logByDate.get(entry.date)
    const word = words.get(entry.wordId)
    rows.push({
      sortKey: `${entry.date} ${entry.createdAt}`,
      values: [
        code,
        'check-in',
        entry.date,
        localTime(entry.createdAt),
        entry.wordId,
        word?.word,
        word?.category,
        entry.intensity,
        entry.energy,
        (entry.triggers ?? []).join(','),
        entry.bodyZones.join(','),
        log?.hadPeriod,
        log?.tookPainkiller,
        entry.note,
      ],
    })
  }
  const datesWithCheckIns = new Set(entries.map((entry) => entry.date))
  for (const log of logs) {
    if (datesWithCheckIns.has(log.date) || (log.hadPeriod === null && log.tookPainkiller === null)) continue
    rows.push({
      sortKey: `${log.date}`,
      values: [code, 'day', log.date, '', '', '', '', '', '', '', '', log.hadPeriod, log.tookPainkiller, ''],
    })
  }
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  const lines = [CSV_COLUMNS.join(SEPARATOR), ...rows.map((row) => row.values.map(cell).join(SEPARATOR))]
  return `﻿${lines.join('\r\n')}\r\n`
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Opens the phone's share menu with the file; where that isn't possible, downloads it. */
export const shareOrDownload = async (file: File): Promise<ShareResult> => {
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelled'
      // some browsers refuse the file type: fall back to a download
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
