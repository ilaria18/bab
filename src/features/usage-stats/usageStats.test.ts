import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recordCheckIn,
  recordOpenedFromReminder,
  recordReminderActive,
  setUsageConsent,
  startUsageStats,
  routineEndpoint,
  usageEndpoint,
  usageStatsCounted,
  type RoutineRow,
  type UsageEvent,
  type UsageRow,
} from './usageStats'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

const at = (iso: string) => new Date(iso).getTime()

describe('usage stats', () => {
  let clock = 0
  let rows: UsageRow[] = []
  let sent: UsageEvent[] = []
  let routines: RoutineRow[] = []
  let routine: { day: 1 | 6; kind: 'training' | 'match'; start: string; end: string }[] = []
  let stop = () => {}

  const start = () => {
    stop = startUsageStats({
      endpoint: 'https://example.test/usage',
      counted: true,
      now: () => clock,
      send: async (_endpoint, events) => {
        rows.push(...events)
        sent = rows.filter((row): row is UsageEvent => !('kind' in row))
        routines = rows.filter((row): row is RoutineRow => 'kind' in row)
        return true
      },
      routine: () => routine,
    })
  }

  const visit = async (from: string, seconds: number) => {
    clock = at(from)
    setVisibility('visible')
    clock += seconds * 1000
    setVisibility('hidden')
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem('bab.usage-stats.v1')!).queue).toEqual([]))
  }

  beforeEach(() => {
    rows = []
    sent = []
    routines = []
    routine = []
    recordReminderActive(false)
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  })

  afterEach(() => stop())

  it('sends nothing without consent', async () => {
    start()
    clock = at('2026-09-28T10:00:00')
    setVisibility('visible')
    clock += 60_000
    setVisibility('hidden')
    await Promise.resolve()
    expect(sent).toEqual([])
  })

  it('describes each visit without any identifier', async () => {
    setUsageConsent(true)
    start()
    await visit('2026-09-28T10:00:00', 95) // Monday, first visit ever
    await visit('2026-09-28T18:00:00', 40) // same day
    await visit('2026-09-29T08:00:00', 20) // next day, same week
    await visit('2026-10-06T08:00:00', 30) // 8 days later: second week of life

    expect(sent.map((e) => [e.day, e.seconds, e.first_ever, e.first_of_day, e.first_of_week, e.week_since_first, e.first_of_life_week])).toEqual([
      ['2026-09-28', 100, true, true, true, 0, true],
      ['2026-09-28', 40, false, false, false, 0, false],
      ['2026-09-29', 20, false, true, false, 0, false],
      ['2026-10-06', 30, false, true, true, 1, true],
    ])
    expect(new Set(sent.map((e) => e.cohort_week))).toEqual(new Set(['2026-W40']))
    expect(new Set(sent.map((e) => e.platform))).toEqual(new Set(['web']))
    sent.forEach((e) => expect(Object.keys(e).sort()).toEqual(
      ['checkins', 'cohort_week', 'continued', 'day', 'first_ever', 'first_of_day', 'first_of_life_week', 'first_of_week', 'from_reminder', 'platform', 'reminder_on', 'seconds', 'v', 'week_since_first'],
    ))
  })

  it('reports the training routine once a week, with no identifier and not linked to the visits', async () => {
    setUsageConsent(true)
    start()
    routine = [{ day: 1, kind: 'training', start: '18:00', end: '20:00' }]
    await visit('2026-09-28T10:00:00', 60) // first visit of week 40
    routine = [...routine, { day: 6, kind: 'match', start: '17:00', end: '19:00' }]
    await visit('2026-09-29T10:00:00', 60) // same week: nothing new
    await visit('2026-10-05T10:00:00', 60) // week 41: the routine as it stands now
    expect(routines).toEqual([
      { v: 3, kind: 'routine', week: '2026-W40', sessions: [{ day: 1, kind: 'training', start: '18:00', end: '20:00' }], platform: 'web' },
      { v: 3, kind: 'routine', week: '2026-W41', sessions: routine, platform: 'web' },
    ])
    expect(routineEndpoint('https://bab-analytics.vercel.app/api/usage')).toBe('https://bab-analytics.vercel.app/api/usage-routine')
    expect(routineEndpoint('https://example.test/other')).toBeNull()
    // a team's phone sends everything to the team's endpoint
    expect(usageEndpoint('https://bab-analytics.vercel.app/api/usage', 'verovolley')).toBe('https://bab-analytics.vercel.app/api/team-usage?team=verovolley')
    expect(usageEndpoint('https://bab-analytics.vercel.app/api/usage', null)).toBe('https://bab-analytics.vercel.app/api/usage')
  })

  it('counts a quick return as the same visit', async () => {
    setUsageConsent(true)
    start()
    await visit('2026-09-28T10:00:00', 60)
    await visit('2026-09-28T10:01:10', 30) // back after 10 s
    expect(sent[1]).toMatchObject({ continued: true, first_of_day: false, seconds: 30 })
  })

  it('drops accidental openings', async () => {
    setUsageConsent(true)
    start()
    clock = at('2026-09-28T10:00:00')
    setVisibility('visible')
    clock += 1000
    setVisibility('hidden')
    await Promise.resolve()
    expect(sent).toEqual([])
  })

  it('keeps rows while offline and sends them later', async () => {
    setUsageConsent(true)
    let online = false
    stop = startUsageStats({
      endpoint: 'https://example.test/usage',
      counted: true,
      now: () => clock,
      send: async (_e, events) => {
        if (!online) return false
        // the weekly routine row travels with the visits; only the visits are counted here
        sent.push(...(events.filter((row) => !('kind' in row)) as UsageEvent[]))
        return true
      },
    })
    clock = at('2026-09-28T10:00:00')
    setVisibility('visible')
    clock += 30_000
    setVisibility('hidden')
    await Promise.resolve()
    expect(sent).toEqual([])

    online = true
    clock = at('2026-09-29T10:00:00')
    setVisibility('visible')
    await vi.waitFor(() => expect(sent).toHaveLength(1))
  })

  it('wipes everything when consent is withdrawn', async () => {
    setUsageConsent(true)
    start()
    await visit('2026-09-28T10:00:00', 30)
    setUsageConsent(false)
    expect(JSON.parse(localStorage.getItem('bab.usage-stats.v1')!)).toMatchObject({ consent: false, firstDay: null, queue: [] })
  })

  it('counts the check-ins completed during a visit, never their content', async () => {
    setUsageConsent(true)
    start()
    clock = at('2026-09-28T10:00:00')
    setVisibility('visible')
    recordCheckIn()
    recordCheckIn()
    clock += 90_000
    setVisibility('hidden')
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].checkins).toBe(2)

    await visit('2026-09-28T18:00:00', 30)
    expect(sent[1].checkins).toBe(0)
  })

  it('marks visits opened from the reminder, and whether the reminder is on', async () => {
    setUsageConsent(true)
    recordReminderActive(true)
    start()
    recordOpenedFromReminder() // the tap arrives just before the app reports it is visible
    await visit('2026-09-28T19:00:00', 60)
    await visit('2026-09-28T21:00:00', 60)
    expect(sent.map((e) => [e.from_reminder, e.reminder_on])).toEqual([
      [true, true],
      [false, true],
    ])
  })

  it('measures nothing in a browser tab or on a computer, only in the installed app', async () => {
    expect(usageStatsCounted(true, false, 'android')).toBe(true) // native app
    expect(usageStatsCounted(false, true, 'ios')).toBe(true) // website on the home screen
    expect(usageStatsCounted(false, true, 'android')).toBe(true)
    expect(usageStatsCounted(false, false, 'ios')).toBe(false) // browser tab on a phone
    expect(usageStatsCounted(false, true, 'web')).toBe(false) // installed on a computer

    setUsageConsent(true)
    stop = startUsageStats({
      endpoint: 'https://example.test/usage',
      counted: false,
      now: () => clock,
      send: async (_e, events) => {
        rows.push(...events)
        return true
      },
    })
    clock = at('2026-09-28T10:00:00')
    setVisibility('visible')
    clock += 60_000
    setVisibility('hidden')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(rows).toEqual([])
    expect(JSON.parse(localStorage.getItem('bab.usage-stats.v1')!).queue).toEqual([])
  })
})
