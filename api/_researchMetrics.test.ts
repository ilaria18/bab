import { describe, expect, it } from 'vitest'
import {
  computeResearchMetrics,
  momentOf,
  POSITIVE_WORD_IDS,
  WORD_SIGNALS,
  zoneRegion,
  type ResearchCheckinRow,
  type RoutineSession,
} from './_researchMetrics'
import { WORDS } from '../src/entities/word/words'

const checkIn = (participant: string, extra: Partial<ResearchCheckinRow> = {}): ResearchCheckinRow => ({
  participant,
  record: 'check-in',
  date: '2026-10-05',
  time: '18:00',
  word_id: 'tight',
  word: 'Tight',
  category: 'muscle',
  intensity: 4,
  energy: 5,
  triggers: ['movement'],
  body_zones: ['kneeLeft'],
  on_period: null,
  took_painkiller: null,
  ...extra,
})
const day = (n: number) => new Date(Date.UTC(2026, 9, 5 + n)).toISOString().slice(0, 10)

describe('research metrics', () => {
  it('groups body zones into regions, keeping front and back apart', () => {
    expect(zoneRegion('kneeLeft')).toBe('knee')
    expect(zoneRegion('kneeRightBack')).toBe('knee (back)')
    expect(zoneRegion('upperBackLeft')).toBe('upper back')
    expect(zoneRegion('headBack')).toBe('head (back)')
    expect(zoneRegion('whole')).toBe('whole')
  })

  it('ranks words by athletes, not check-ins, and names them only with 3 athletes', () => {
    const rows = [
      checkIn('A'), checkIn('B'), checkIn('C'),
      // one athlete using "Sharp" many times stays under "Other"
      ...Array.from({ length: 6 }, () => checkIn('A', { word_id: 'sharp', word: 'Sharp', intensity: 8 })),
    ]
    const m = computeResearchMetrics(rows)
    expect(m.feel.words).toEqual([
      { label: 'Tight', athletes: 3, checkIns: 3, meanIntensity: 4, signal: 'green' },
      { label: 'Other', athletes: 1, checkIns: 6, meanIntensity: 8 },
    ])
    expect(computeResearchMetrics([checkIn('A'), checkIn('B')]).feel.words).toEqual([])
  })

  it('body literacy: compares each athlete’s first 5 check-ins with her last 5', () => {
    // early: always "tight", whole body, no moment; late: 5 different words, precise area, with a moment
    const words = ['sore', 'achy', 'stiff', 'crampy', 'sharp']
    const athlete = (p: string) => [
      ...Array.from({ length: 5 }, (_, i) => checkIn(p, { date: day(i), body_zones: ['whole'], triggers: [] })),
      ...words.map((w, i) => checkIn(p, { date: day(20 + i), word_id: w, word: w, body_zones: ['kneeLeft'], triggers: ['movement'] })),
    ]
    const m = computeResearchMetrics([...athlete('A'), ...athlete('B'), ...athlete('C'), checkIn('D')])
    expect(m.literacy.vocabulary).toMatchObject({ athletes: 3, up: 3, same: 0, down: 0, medianBefore: 1, medianAfter: 5 })
    expect(m.literacy.precision).toMatchObject({ up: 3, medianBefore: 0, medianAfter: 100 })
    expect(m.literacy.moments).toMatchObject({ up: 3 })
    // too few athletes with enough check-ins: nothing shown
    expect(computeResearchMetrics(athlete('A')).literacy.vocabulary).toMatchObject({ athletes: 1, up: null })
  })

  it('cycle: compares each athlete’s period days with her own other days', () => {
    const athlete = (p: string, onPeriod: number, other: number) => [
      checkIn(p, { date: day(0), intensity: onPeriod, energy: 2, on_period: true }),
      checkIn(p, { date: day(1), intensity: onPeriod, energy: 2, on_period: true, took_painkiller: true }),
      checkIn(p, { date: day(10), intensity: other, energy: 5, on_period: false, took_painkiller: false }),
      checkIn(p, { date: day(11), intensity: other, energy: 5, on_period: false }),
    ]
    const m = computeResearchMetrics([...athlete('A', 7, 3), ...athlete('B', 6, 2), ...athlete('C', 4, 4)])
    expect(m.cycle.intensity).toMatchObject({ athletes: 3, up: 2, same: 1, down: 0, medianChange: 4 })
    expect(m.cycle.energy).toMatchObject({ down: 3, medianChange: -3 })
    expect(m.cycle.painkiller.period).toEqual({ days: 3, athletes: 3, pct: 100 })
    expect(m.cycle.painkiller.other).toEqual({ days: 3, athletes: 3, pct: 0 })
  })

  it('training: places each check-in around the routine', () => {
    // Monday training 18:00-20:00, Saturday match 17:00-19:00; 2026-10-05 is a Monday
    const routine: RoutineSession[] = [
      { day: 1, kind: 'training', start: '18:00', end: '20:00' },
      { day: 6, kind: 'match', start: '17:00', end: '19:00' },
    ]
    expect(momentOf('2026-10-05', '21:30', routine)).toBe('After training')
    expect(momentOf('2026-10-05', '15:00', routine)).toBe('Before a session')
    expect(momentOf('2026-10-05', '08:00', routine)).toBe('Other, session day')
    expect(momentOf('2026-10-10', '20:00', routine)).toBe('After a match')
    expect(momentOf('2026-10-11', '10:00', routine)).toBe('Day after a match')
    expect(momentOf('2026-10-07', '10:00', routine)).toBe('Rest day')

    const athlete = (p: string) => [
      checkIn(p, { date: '2026-10-05', time: '21:00', intensity: 6 }),
      checkIn(p, { date: '2026-10-12', time: '21:00', intensity: 8 }),
      checkIn(p, { date: '2026-10-07', time: '10:00', intensity: 2 }),
      checkIn(p, { date: '2026-10-08', time: '10:00', intensity: 2 }),
    ]
    const participants = ['A', 'B', 'C'].map((code) => ({ code, routine }))
    const m = computeResearchMetrics([...athlete('A'), ...athlete('B'), ...athlete('C')], participants)
    expect(m.training.athletesWithRoutine).toBe(3)
    expect(m.training.planned).toEqual({ minutesPerWeek: 240, sessionsPerWeek: 2, matchesPerWeek: 1 })
    expect(m.training.moments.find((x) => x.label === 'After training')).toMatchObject({ checkIns: 6, athletes: 3, meanIntensity: 7 })
    expect(m.training.afterSessionVsRest).toMatchObject({ athletes: 3, up: 3, medianBefore: 2, medianAfter: 7 })
  })

  it('coverage: good days (strong / light only), symptom days and days without data', () => {
    const athlete = (p: string) => [
      checkIn(p, { date: day(0), word_id: 'strong', word: 'Strong' }),
      checkIn(p, { date: day(1) }),
      checkIn(p, { date: day(1), word_id: 'light', word: 'Light' }),
      { ...checkIn(p, { date: day(2) }), record: 'day' as const, word_id: null, word: null, on_period: true },
      checkIn(p, { date: day(9), word_id: 'strong', word: 'Strong' }),
    ]
    const m = computeResearchMetrics([...athlete('A'), ...athlete('B'), ...athlete('C')])
    expect(m.coverage.days).toEqual({ span: 10, good: 2, symptom: 1, answerOnly: 1, none: 6 })
    expect(m.coverage.medianCoveredPct).toBe(40)
    expect(m.coverage.bands.find((b) => b.label === '25–50%')?.athletes).toBe(3)
  })

  it('knows the same signals and positive words as the app', () => {
    expect(WORD_SIGNALS).toEqual(Object.fromEntries(WORDS.map((w) => [w.id, w.signal])))
    expect([...POSITIVE_WORD_IDS]).toEqual(['strong', 'light'])
  })
})
