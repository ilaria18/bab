import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setUsageConsent, startUsageStats, type UsageEvent } from './usageStats'

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

const at = (iso: string) => new Date(iso).getTime()

describe('usage stats', () => {
  let clock = 0
  let sent: UsageEvent[] = []
  let stop = () => {}

  const start = () => {
    stop = startUsageStats({
      endpoint: 'https://example.test/usage',
      now: () => clock,
      send: async (_endpoint, events) => {
        sent.push(...events)
        return true
      },
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
    sent = []
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
      ['cohort_week', 'continued', 'day', 'first_ever', 'first_of_day', 'first_of_life_week', 'first_of_week', 'platform', 'seconds', 'v', 'week_since_first'],
    ))
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
      now: () => clock,
      send: async (_e, events) => {
        if (!online) return false
        sent.push(...events)
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
})
