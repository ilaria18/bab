import { describe, expect, it } from 'vitest'
import { computeMetrics, isoWeek, type VisitRow, type WeekRow } from './_metrics'

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
    const weeks: WeekRow[] = Array.from({ length: 5 }, () => ({ week: '2026-W41', active_days: '1-2', platform: 'android' }))
    const m = computeMetrics('2026-10-05', [...monday, ...tuesday], weeks, null)

    expect(m.days[0]).toMatchObject({ activeUsers: 6, openings: 6, checkinsPerUser: 1 })
    expect(m.days[1]).toMatchObject({ activeUsers: null, openings: 3, checkinsPerUser: null })
    expect(m.weeks[0]).toMatchObject({ activeUsers: 6, daysUsedPerUser: 1.5, checkins: 9, reminderOnPct: 100 })
    expect(m.retention[0]).toMatchObject({ started: 6, stillActive: 6, retentionPct: 100 })
    expect(m.spread[0]).toMatchObject({ days1to2: 5, reported: 5, notReported: 1 })
    expect(m.summary).toMatchObject({ started: 6, totalCheckins: 9, latestWeek: 1 })
  })

  it('filters by platform', () => {
    const rows = [visit('2026-10-05', { platform: 'ios' }), visit('2026-10-05', { platform: 'android' })]
    expect(computeMetrics('2026-10-05', rows, [], 'ios').days[0].openings).toBe(1)
  })
})
