import { describe, expect, it } from 'vitest'
import type { CheckInEntry } from '@/entities/check-in/types'
import { cycleCard, energyCard, trainingCard, wordsCard, zonesCard } from './patterns'

let n = 0
const entry = (date: string, extra: Partial<CheckInEntry> = {}): CheckInEntry => ({
  id: String(n++),
  wordId: 'sore',
  bodyZones: ['kneeLeft'],
  intensity: 4,
  energy: 4,
  date,
  createdAt: new Date(`${date}T10:00:00`).toISOString(),
  ...extra,
})
const at = (date: string, time: string, extra: Partial<CheckInEntry> = {}) =>
  entry(date, { createdAt: new Date(`${date}T${time}:00`).toISOString(), ...extra })

describe('my patterns', () => {
  it('compares period days with the other days once there are 3 of each, leaving strong/light out of intensity', () => {
    const logs = ['2026-10-01', '2026-10-02', '2026-10-03'].map((date) => ({ date, hadPeriod: true, tookPainkiller: null }))
      .concat(['2026-10-10', '2026-10-11', '2026-10-12'].map((date) => ({ date, hadPeriod: false, tookPainkiller: null })))
    const entries = [
      entry('2026-10-01', { intensity: 7, energy: 2, wordId: 'crampy' }),
      entry('2026-10-02', { intensity: 6, energy: 3, wordId: 'crampy' }),
      entry('2026-10-03', { intensity: 10, energy: 3, wordId: 'strong' }),
      entry('2026-10-10', { intensity: 3, energy: 5 }),
      entry('2026-10-11', { intensity: 2, energy: 6 }),
    ]
    expect(cycleCard(entries, logs)).toMatchObject({ ready: false, have: 5, need: 6 })
    const ready = cycleCard([...entries, entry('2026-10-12', { intensity: 4, energy: 5 })], logs)
    expect(ready).toMatchObject({
      ready: true,
      period: { intensity: 6.5, energy: 2.7, checkIns: 3 },
      other: { intensity: 3, energy: 5.3, checkIns: 3 },
      topPeriodWord: 'crampy',
    })
  })

  it('lists the top words of the last 30 days with their trend', () => {
    const entries = [
      ...Array.from({ length: 3 }, () => entry('2026-10-20', { wordId: 'tight' })),
      entry('2026-10-21', { wordId: 'sore' }),
      entry('2026-10-22', { wordId: 'bloated' }),
      entry('2026-09-10', { wordId: 'sore' }),
      entry('2026-09-11', { wordId: 'sore' }),
    ]
    expect(wordsCard(entries, '2026-10-30')).toEqual({
      ready: true,
      have: 5,
      need: 5,
      top: [
        { wordId: 'tight', count: 3, trend: 'new' },
        { wordId: 'bloated', count: 1, trend: 'new' },
        { wordId: 'sore', count: 1, trend: 'down' },
      ],
    })
  })

  it('finds the areas marked most, and one that keeps coming back with a yellow/red word', () => {
    const entries = [
      entry('2026-10-26', { wordId: 'sharp', bodyZones: ['ankleRight'] }),
      entry('2026-10-27', { wordId: 'sharp', bodyZones: ['ankleRight'] }),
      entry('2026-10-28', { wordId: 'unstable', bodyZones: ['ankleRight', 'kneeLeft'] }),
      entry('2026-10-29'),
      entry('2026-10-29', { wordId: 'strong', bodyZones: ['whole'] }),
      entry('2026-10-30'),
    ]
    const zones = zonesCard(entries, '2026-10-30')
    expect(zones.ready).toBe(true)
    expect(zones.top).toEqual([
      { zone: 'ankleRight', count: 3 },
      { zone: 'kneeLeft', count: 3 },
    ])
    expect(zones.keepsComingBack).toEqual(['ankleRight'])
  })

  it('splits check-ins into before and after training from the routine', () => {
    // Monday 2026-10-26 and 2026-11-02, training 18:00–20:00
    const routine = [{ day: 1 as const, kind: 'training' as const, start: '18:00', end: '20:00' }]
    const entries = [
      at('2026-10-26', '16:00', { intensity: 2, energy: 6 }),
      at('2026-11-02', '17:30', { intensity: 3, energy: 6 }),
      at('2026-10-26', '21:00', { intensity: 6, energy: 3, wordId: 'tight' }),
      at('2026-11-02', '22:30', { intensity: 7, energy: 2, wordId: 'tight' }),
      at('2026-10-27', '21:00', { intensity: 9 }), // Tuesday: no training
    ]
    expect(trainingCard(entries, routine)).toMatchObject({
      ready: true,
      hasRoutine: true,
      before: { intensity: 2.5, energy: 6, checkIns: 2 },
      after: { intensity: 6.5, energy: 2.5, checkIns: 2 },
      topAfterWord: 'tight',
    })
    expect(trainingCard(entries, [])).toMatchObject({ ready: false, hasRoutine: false })
  })

  it('compares the energy of the last 2 weeks with the 2 before and counts the good days', () => {
    const entries = [
      entry('2026-10-28', { energy: 6 }),
      entry('2026-10-29', { energy: 5 }),
      entry('2026-10-30', { energy: 4, wordId: 'light' }),
      entry('2026-10-10', { energy: 3 }),
      entry('2026-10-20', { wordId: 'strong' }),
    ]
    expect(energyCard(entries, '2026-10-30')).toMatchObject({
      ready: true,
      recentEnergy: 4.8,
      earlierEnergy: 3,
      positiveCount: 2,
      positiveDays: 2,
    })
  })
})
