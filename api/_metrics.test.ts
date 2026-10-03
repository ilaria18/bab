import { describe, expect, it } from 'vitest'
import { computeMetrics, isoWeek, type PeriodDayRow, type VisitRow } from './_metrics'

const visit = (day: string, extra: Partial<VisitRow> = {}): VisitRow => ({
  day, seconds: 60, cohort_week: '2026-W41', week_since_first: 0, first_ever: false, first_of_day: true,
  first_of_week: false, first_of_life_week: false, continued: false, platform: 'android', checkins: 1,
  from_reminder: false, reminder_on: true, ...extra,
})

describe('pilot metrics', () => {
  it('computes ISO weeks', () => {
    expect([isoWeek('2026-10-05'), isoWeek('2026-01-01'), isoWeek('2027-01-03')]).toEqual(['2026-W41', '2026-W01', '2026-W53'])
  })

  it('counts athletes from the flags and hides groups under 5', () => {
    // 6 athletes start on Monday 5 Oct; 3 of them come back on Tuesday
    const monday = Array.from({ length: 6 }, () =>
      visit('2026-10-05', { first_ever: true, first_of_week: true, first_of_life_week: true }))
    const tuesday = Array.from({ length: 3 }, () => visit('2026-10-06'))
    const m = computeMetrics('2026-10-05', [...monday, ...tuesday], null)

    expect(m.days[0]).toMatchObject({ activeUsers: 6, openings: 6, checkinsPerUser: 1 })
    expect(m.days[1]).toMatchObject({ activeUsers: null, openings: 3, checkinsPerUser: null })
    expect(m.weeks[0]).toMatchObject({ activeUsers: 6, daysUsedPerUser: 1.5, checkins: 9, reminderOnPct: 100 })
    expect(m.retention[0]).toMatchObject({ started: 6, stillActive: 6, retentionPct: 100 })
    expect(m.summary).toMatchObject({ started: 6, totalCheckins: 9, latestWeek: 1 })
  })

  it('filters by platform', () => {
    const rows = [visit('2026-10-05', { platform: 'ios' }), visit('2026-10-05', { platform: 'android' })]
    expect(computeMetrics('2026-10-05', rows, 'ios').days[0].openings).toBe(1)
  })
})

describe('training routines', () => {
  it('summarises the weekly routines only with at least 5 phones', () => {
    const r = (sessions: { day: number; kind: string; start: string; end: string }[]) => ({ week: '2026-W41', sessions, platform: 'android' })
    const training = { day: 1, kind: 'training', start: '18:00', end: '20:00' }
    const match = { day: 6, kind: 'match', start: '17:00', end: '19:00' }
    const rows = [r([training, match]), r([training, match]), r([training]), r([training, { ...training, day: 3 }]), r([training, match]), r([])]
    const m = computeMetrics('2026-10-05', [], null, rows)
    expect(m.routines[0]).toMatchObject({ reported: 6, withRoutinePct: 83, sessionsPerAthlete: 2, trainingMinutes: 120, matches: 1 })
    expect(m.routines[0].byWeekday[0]).toEqual({ label: 'Mon', pct: 100 })
    expect(computeMetrics('2026-10-05', [], null, rows.slice(0, 3)).routines[0]).toMatchObject({ reported: 3, withRoutinePct: null, byWeekday: [] })
  })
})

describe('pilot questions', () => {
  // 6 athletes active in week 1
  const base = Array.from({ length: 6 }, () => visit('2026-10-05', { first_of_week: true, session_day: 'training', patterns_views: 0 }))

  it('compares days with a training, a match or no session', () => {
    const extra = [
      ...Array.from({ length: 5 }, () => visit('2026-10-07', { session_day: 'none', seconds: 120, checkins: 0 })),
      visit('2026-10-07', { session_day: 'none', first_of_day: false, seconds: 60, checkins: 0 }),
      ...Array.from({ length: 2 }, () => visit('2026-10-10', { session_day: 'match' })),
    ]
    const m = computeMetrics('2026-10-05', [...base, ...extra], null)
    expect(m.sessionDays.find((g) => g.kind === 'training')).toMatchObject({ athleteDays: 6, openingsPerDay: 1, minutesPerDay: 1, checkinsPerDay: 1 })
    expect(m.sessionDays.find((g) => g.kind === 'none')).toMatchObject({ athleteDays: 5, openingsPerDay: 1.2, minutesPerDay: 2.2, checkinsPerDay: 0 })
    expect(m.sessionDays.find((g) => g.kind === 'match')).toMatchObject({ athleteDays: null, minutesPerDay: null })
  })

  it('counts who opens My patterns and how often', () => {
    const rows = [
      ...base.slice(0, 3),
      ...base.slice(3).map((r) => ({ ...r, patterns_views: 2, patterns_first_of_week: true, patterns_first_ever: true })),
      visit('2026-10-06', { patterns_views: 1 }),
    ]
    const m = computeMetrics('2026-10-05', rows, null)
    expect(m.patterns.weeks[0]).toMatchObject({ active: 6, lookedPct: 50, viewsPerActive: 1.2, viewsPerLooker: 2.3, openingsWithPatternsPct: 57 })
    expect(m.patterns.everOpened).toBeNull() // 3 athletes: hidden
    expect(m.patterns.tracked).toBe(true)
  })

  it('compares period days with other days only when the rows are on', () => {
    const day = (on_period: boolean | null, visits: number, checkins: number): PeriodDayRow =>
      ({ week: '2026-W41', on_period, visits, seconds: visits * 120, checkins, platform: 'ios' })
    const rows = [
      ...Array.from({ length: 5 }, () => day(true, 2, 1)),
      ...Array.from({ length: 6 }, (_, i) => day(false, 1, i < 3 ? 1 : 0)),
      day(null, 1, 0),
    ]
    expect(computeMetrics('2026-10-05', base, null).period).toBeNull()
    const m = computeMetrics('2026-10-05', base, null, [], rows)
    expect(m.period?.groups).toEqual([
      { onPeriod: true, athleteDays: 5, openingsPerDay: 2, minutesPerDay: 4, checkinsPerDay: 1, daysWithCheckInPct: 100 },
      { onPeriod: false, athleteDays: 6, openingsPerDay: 1, minutesPerDay: 2, checkinsPerDay: 0.5, daysWithCheckInPct: 50 },
      { onPeriod: null, athleteDays: null, openingsPerDay: null, minutesPerDay: null, checkinsPerDay: null, daysWithCheckInPct: null },
    ])
  })
})
