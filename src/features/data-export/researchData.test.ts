import { describe, expect, it } from 'vitest'
import type { CheckInEntry } from '@/entities/check-in/types'
import { buildRows, participantCode } from './researchData'

const entry: CheckInEntry = {
  id: 'abc',
  wordId: 'tight',
  bodyZones: ['kneeLeft'],
  intensity: 6,
  energy: 3,
  triggers: ['movement'],
  note: '  ',
  date: '2026-10-05',
  createdAt: new Date(2026, 9, 5, 18, 30).toISOString(),
}

describe('research data', () => {
  it('builds one row per check-in with that day’s answers, and day rows for days without check-ins', () => {
    const rows = buildRows(
      [entry],
      [
        { date: '2026-10-05', hadPeriod: true, tookPainkiller: false },
        { date: '2026-10-04', hadPeriod: true, tookPainkiller: null },
        { date: '2026-10-03', hadPeriod: null, tookPainkiller: null },
      ],
      new Map([['tight', { word: 'Tight', category: 'muscle' }]]),
    )
    expect(rows).toEqual([
      {
        record_id: 'day-2026-10-04', record: 'day', date: '2026-10-04', time: null, word_id: null, word: null,
        category: null, intensity: null, energy: null, triggers: [], body_zones: [], on_period: true,
        took_painkiller: null, note: null,
      },
      {
        record_id: 'abc', record: 'check-in', date: '2026-10-05', time: '18:30', word_id: 'tight', word: 'Tight',
        category: 'muscle', intensity: 6, energy: 3, triggers: ['movement'], body_zones: ['kneeLeft'],
        on_period: true, took_painkiller: false, note: null,
      },
    ])
  })

  it('keeps the same participant code on this phone', () => {
    const code = participantCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(participantCode()).toBe(code)
  })
})
