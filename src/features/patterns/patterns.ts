import type { BodyZone, CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { usesPainScale } from '@/entities/check-in/vasScale'
import { WORDS } from '@/entities/word/words'
import type { Session } from '@/features/reminder/trainingRoutine'
import { toDateKey } from '@/shared/lib/dateKey'

/**
 * "My patterns": what the athlete's own check-ins say over time, computed on her phone only.
 * Every card needs a minimum of data before it says anything (`ready`); until then it reports
 * how far she is (`have` / `need`), so the page is also a reason to keep checking in.
 * Observations only: nothing here is a diagnosis or a score.
 */

const SIGNAL = new Map<string, string>(WORDS.map((w) => [w.id, w.signal]))
const isPositive = (e: CheckInEntry) => !usesPainScale(e.wordId)
const isSymptom = (e: CheckInEntry) => usesPainScale(e.wordId)

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]): number | null =>
  values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null
const intensityOf = (list: CheckInEntry[]) => mean(list.filter(isSymptom).map((e) => e.intensity))
const energyOf = (list: CheckInEntry[]) =>
  mean(list.map((e) => e.energy).filter((v): v is NonNullable<typeof v> => v !== undefined))

const DAY_MS = 86_400_000
const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
/** entries on the `days` days ending with `until` (included) */
const within = (entries: CheckInEntry[], until: string, days: number) => {
  const from = shiftDay(until, -(days - 1))
  return entries.filter((e) => e.date >= from && e.date <= until)
}

/** most recent first, so that on equal counts the one used last comes first */
const newestFirst = (list: CheckInEntry[]) =>
  [...list].sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`))

/** how many times each key appears; on equal counts, the key met first in `keys` wins
 * (callers pass keys newest first: the most recently used comes first) */
const topCounts = <K extends string>(keys: K[], limit: number) => {
  const counts = new Map<K, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  // Array.prototype.sort is stable: equal counts keep the order they were first met in
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

export type Progress = { ready: boolean; have: number; need: number }
const progress = (have: number, need: number): Progress => ({ ready: have >= need, have: Math.min(have, need), need })

/** 1 · My cycle and my body: check-ins on period days vs the other days */
export const cycleCard = (entries: CheckInEntry[], logs: DailyLog[]) => {
  const periodByDay = new Map(logs.map((log) => [log.date, log.hadPeriod]))
  const onPeriod = entries.filter((e) => periodByDay.get(e.date) === true)
  const otherDays = entries.filter((e) => periodByDay.get(e.date) === false)
  const need = 3
  const p = progress(Math.min(onPeriod.length, need) + Math.min(otherDays.length, need), 2 * need)
  const top = topCounts(newestFirst(onPeriod.filter(isSymptom)).map((e) => e.wordId), 1)[0]
  return {
    ...p,
    period: { intensity: intensityOf(onPeriod), energy: energyOf(onPeriod), checkIns: onPeriod.length },
    other: { intensity: intensityOf(otherDays), energy: energyOf(otherDays), checkIns: otherDays.length },
    topPeriodWord: top?.key ?? null,
  }
}

export type Trend = 'new' | 'up' | 'down' | 'same'

/** 2 · My words: the most frequent sensations of the last 30 days, compared with the 30 before */
export const wordsCard = (entries: CheckInEntry[], today: string) => {
  const last = within(entries, today, 30)
  const before = within(entries, shiftDay(today, -30), 30)
  const beforeCounts = new Map(topCounts(before.map((e) => e.wordId), 99).map((c) => [c.key, c.count]))
  return {
    ...progress(last.length, 5),
    // each check-in counts once for its word
    top: topCounts(newestFirst(last).map((e) => e.wordId), 3).map(({ key, count }) => {
      const previous = beforeCounts.get(key) ?? 0
      const trend: Trend = before.length === 0 ? 'same' : previous === 0 ? 'new' : count > previous ? 'up' : count < previous ? 'down' : 'same'
      return { wordId: key, count, trend }
    }),
  }
}

/** 3 · The areas that speak most (last 30 days), and any that keep coming back with a yellow/red word */
export const zonesCard = (entries: CheckInEntry[], today: string) => {
  // a check-in counts once for each area it marks (left/right and front/back are different areas);
  // "the whole body" and the strong/light check-ins are not areas
  const zonesOf = (e: CheckInEntry) => [...new Set(e.bodyZones.filter((z) => z !== 'whole'))]
  const last = newestFirst(within(entries, today, 30).filter(isSymptom)).filter((e) => zonesOf(e).length > 0)
  const top = topCounts(last.flatMap(zonesOf), 3).map(({ key, count }) => ({ zone: key as BodyZone, count }))
  // a yellow/red sensation in the same area on 3 different days of the last week: worth talking about
  const alertDays = new Map<BodyZone, Set<string>>()
  for (const e of within(entries, today, 7).filter(isSymptom)) {
    if (SIGNAL.get(e.wordId) === 'green') continue
    for (const zone of zonesOf(e)) alertDays.set(zone, (alertDays.get(zone) ?? new Set()).add(e.date))
  }
  const keepsComingBack = [...alertDays.entries()].filter(([, days]) => days.size >= 3).map(([zone]) => zone)
  return { ...progress(last.length, 5), top, keepsComingBack }
}

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
/** check-ins made up to 4 hours before a session starts, or up to 4 hours after it ends */
const WINDOW = 4 * 60
const WEEK = 7 * 1440

/**
 * 4 · Before and after training: how she arrives at sessions and how she leaves them.
 * Times are counted in minutes of the week, so a session that ends after midnight, or a check-in
 * just after midnight following a late match, still falls in the right window. Only check-ins made
 * live count: one logged later for an earlier day has the time it was written, not when it was felt.
 * Each check-in counts at most once as "before" and once as "after".
 */
export const trainingCard = (entries: CheckInEntry[], routine: Session[]) => {
  const before: CheckInEntry[] = []
  const after: CheckInEntry[] = []
  const sessions = routine.map((s) => {
    const start = (s.day - 1) * 1440 + minutesOf(s.start)
    const duration = (minutesOf(s.end) - minutesOf(s.start) + 1440) % 1440
    return { start, end: start + duration }
  })
  for (const e of entries) {
    const at = new Date(e.createdAt)
    if (Number.isNaN(at.getTime()) || toDateKey(at) !== e.date) continue
    const minute = ((at.getDay() + 6) % 7) * 1440 + at.getHours() * 60 + at.getMinutes()
    const ahead = (from: number, to: number) => (to - from + WEEK) % WEEK
    if (sessions.some((s) => ahead(minute, s.start) > 0 && ahead(minute, s.start) <= WINDOW)) before.push(e)
    if (sessions.some((s) => ahead(s.end, minute) > 0 && ahead(s.end, minute) <= WINDOW)) after.push(e)
  }
  const need = 2
  const top = topCounts(newestFirst(after.filter(isSymptom)).map((e) => e.wordId), 1)[0]
  return {
    ...progress(Math.min(before.length, need) + Math.min(after.length, need), 2 * need),
    hasRoutine: routine.length > 0,
    before: { intensity: intensityOf(before), energy: energyOf(before), checkIns: before.length },
    after: { intensity: intensityOf(after), energy: energyOf(after), checkIns: after.length },
    topAfterWord: top?.key ?? null,
  }
}

/** 5 · Energy and good days: energy of the last 2 weeks vs the 2 before, and the positive check-ins */
export const energyCard = (entries: CheckInEntry[], today: string) => {
  const recent = within(entries, today, 14)
  const earlier = within(entries, shiftDay(today, -14), 14)
  const positive = within(entries, today, 30).filter(isPositive)
  return {
    ...progress(recent.filter((e) => e.energy !== undefined).length, 3),
    recentEnergy: energyOf(recent),
    earlierEnergy: energyOf(earlier),
    positiveCount: positive.length,
    positiveDays: new Set(positive.map((e) => e.date)).size,
    strongCount: positive.filter((e) => e.wordId === 'strong').length,
    lightCount: positive.filter((e) => e.wordId === 'light').length,
  }
}
