import { describe, expect, it } from 'vitest'
import type { CheckInEntry } from '@/entities/check-in/types'
import { buildCsv, CSV_COLUMNS, participantCode } from './exportData'

const entry = (extra: Partial<CheckInEntry>): CheckInEntry => ({
  id: 'x',
  wordId: 'tight',
  bodyZones: ['kneeLeft', 'kneeLeftBack'],
  intensity: 6,
  energy: 3,
  triggers: ['movement'],
  date: '2026-10-05',
  createdAt: new Date(2026, 9, 5, 18, 30).toISOString(),
  ...extra,
})
const words = new Map([['tight', { word: 'Tight', category: 'pain' }]])

describe('data export', () => {
  it('writes one row per check-in with that day’s answers, and day rows for days without check-ins', () => {
    const csv = buildCsv(
      'K7QH3M',
      [entry({ note: 'after "sprints"; sore' })],
      [
        { date: '2026-10-05', hadPeriod: true, tookPainkiller: false },
        { date: '2026-10-04', hadPeriod: true, tookPainkiller: null },
        { date: '2026-10-03', hadPeriod: null, tookPainkiller: null },
      ],
      words,
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe(CSV_COLUMNS.join(';'))
    expect(lines.slice(1)).toEqual([
      'K7QH3M;day;2026-10-04;;;;;;;;;yes;;',
      'K7QH3M;check-in;2026-10-05;18:30;tight;Tight;pain;6;3;movement;kneeLeft,kneeLeftBack;yes;no;"after ""sprints""; sore"',
    ])
  })

  it('keeps the same participant code on this phone', () => {
    const code = participantCode()
    expect(code).toMatch(/^[A-Z2-9]{6}$/)
    expect(participantCode()).toBe(code)
  })
})
