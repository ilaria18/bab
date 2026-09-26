import { describe, expect, it } from 'vitest'
import { pastOrTodayKey } from './dateKey'

describe('pastOrTodayKey', () => {
  it('keeps today and past days, turns a missing or future day into today (undefined)', () => {
    expect(pastOrTodayKey('2026-10-05', '2026-10-05')).toBe('2026-10-05')
    expect(pastOrTodayKey('2026-09-30', '2026-10-05')).toBe('2026-09-30')
    expect(pastOrTodayKey('2026-10-06', '2026-10-05')).toBeUndefined()
    expect(pastOrTodayKey(null, '2026-10-05')).toBeUndefined()
  })
})
