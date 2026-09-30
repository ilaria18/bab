import type { BodyZone, CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { usesPainScale } from '@/entities/check-in/vasScale'
import { WORDS } from '@/entities/word/words'
import type { Session } from '@/features/reminder/trainingRoutine'

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

const topCounts = <K extends string>(keys: K[], limit: number) => {
  const counts = new Map<K, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
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
  const top = topCounts(onPeriod.filter(isSymptom).map((e) => e.wordId), 1)[0]
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
    top: topCounts(last.map((e) => e.wordId), 3).map(({ key, count }) => {
      const previous = beforeCounts.get(key) ?? 0
      const trend: Trend = before.length === 0 ? 'same' : previous === 0 ? 'new' : count > previous ? 'up' : count < previous ? 'down' : 'same'
      return { wordId: key, count, trend }
    }),
  }
}

/** 3 · The areas that speak most (last 30 days), and any that keep coming back with a yellow/red word */
export const zonesCard = (entries: CheckInEntry[], today: string) => {
  const last = within(entries, today, 30).filter(isSymptom)
  const zonesOf = (e: CheckInEntry) => e.bodyZones.filter((z) => z !== 'whole')
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
const isoWeekday = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}
/** check-ins made up to 4 hours before a session starts, or up to 4 hours after it ends */
const WINDOW = 4 * 60

/** 4 · Before and after training: how she arrives at sessions and how she leaves them */
export const trainingCard = (entries: CheckInEntry[], routine: Session[]) => {
  const before: CheckInEntry[] = []
  const after: CheckInEntry[] = []
  for (const e of entries) {
    const at = new Date(e.createdAt)
    if (Number.isNaN(at.getTime())) continue
    const minute = at.getHours() * 60 + at.getMinutes()
    for (const session of routine.filter((s) => s.day === isoWeekday(e.date))) {
      const start = minutesOf(session.start)
      const end = minutesOf(session.end)
      if (minute >= start - WINDOW && minute < start) before.push(e)
      else if (end > start && minute > end && minute <= end + WINDOW) after.push(e)
    }
  }
  const need = 2
  const top = topCounts(after.filter(isSymptom).map((e) => e.wordId), 1)[0]
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
