import { describe, expect, it } from 'vitest'
import { computeResearchMetrics, POSITIVE_WORD_IDS, WORD_SIGNALS, zoneRegion, type ResearchCheckinRow } from './_researchMetrics'
import { WORDS } from '../src/entities/word/words'

const checkIn = (participant: string, extra: Partial<ResearchCheckinRow> = {}): ResearchCheckinRow => ({
  participant,
  record: 'check-in',
  date: '2026-10-05',
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

describe('research metrics', () => {
  it('groups body zones into regions, keeping front and back apart', () => {
    expect(zoneRegion('kneeLeft')).toBe('knee')
    expect(zoneRegion('kneeRightBack')).toBe('knee (back)')
    expect(zoneRegion('upperBackLeft')).toBe('upper back')
    expect(zoneRegion('lowerBackRight')).toBe('lower back')
    expect(zoneRegion('headBack')).toBe('head (back)')
    expect(zoneRegion('whole')).toBe('whole')
  })

  it('names a word only when at least 3 athletes used it, the rest is "Other"', () => {
    const rows = [
      checkIn('A'), checkIn('B'), checkIn('C'), checkIn('A'),
      checkIn('A', { word: 'Sharp', category: 'pain', intensity: 8 }),
    ]
    const m = computeResearchMetrics(rows)
    expect(m.summary).toMatchObject({ athletes: 3, checkIns: 5, medianPerAthlete: 1 })
    expect(m.words).toEqual([
      { label: 'Tight', count: 4, athletes: 3, meanIntensity: 4, extra: 'muscle' },
      { label: 'Other', count: 1, athletes: 1, meanIntensity: 8 },
    ])
    // a check-in on both knees counts once for "knee"
    expect(computeResearchMetrics(rows.map((r) => ({ ...r, body_zones: ['kneeLeft', 'kneeRight'] }))).zones[0]).toMatchObject({ label: 'knee', count: 5 })
  })

  it('compares check-ins on period days with the others, hiding small groups', () => {
    const rows = [
      checkIn('A', { intensity: 7, energy: 2, category: 'pain' }), { ...checkIn('A'), record: 'day' as const, word: null, on_period: true },
      checkIn('B', { intensity: 6, energy: 3, on_period: true }),
      checkIn('C', { intensity: 8, energy: 2, on_period: true }),
      checkIn('D', { intensity: 2, energy: 6, on_period: false }),
    ]
    const m = computeResearchMetrics(rows)
    expect(m.period.yes).toEqual({ checkIns: 3, athletes: 3, meanIntensity: 7, meanEnergy: 2.3, painSharePct: 33, positiveSharePct: 0, alertSharePct: 0 })
    expect(m.period.no).toMatchObject({ checkIns: 1, athletes: 1, meanIntensity: null, meanEnergy: null })
  })

  it('shows nothing detailed with fewer than 3 athletes', () => {
    const m = computeResearchMetrics([checkIn('A'), checkIn('B')])
    expect(m.words).toEqual([])
    expect(m.summary.medianPerAthlete).toBeNull()
  })

  it('keeps strong / light out of the intensity averages and counts them apart', () => {
    const rows = [
      checkIn('A', { intensity: 2 }), checkIn('B', { intensity: 4 }), checkIn('C', { intensity: 6 }),
      checkIn('A', { word_id: 'strong', word: 'Strong', intensity: 10 }),
      checkIn('B', { word_id: 'sharp', word: 'Sharp', category: 'pain', intensity: 8 }),
    ]
    const m = computeResearchMetrics(rows)
    expect(m.summary.meanIntensity).toBe(5) // (2 + 4 + 6 + 8) / 4, the 10 of "strong" left out
    expect(m.summary.positiveSharePct).toBe(20)
    expect(m.intensity[10].count).toBe(0)
    expect(m.signals.map((s) => [s.label, s.count])).toEqual([
      ['Positive', 1],
      ['Normal (green)', 3],
      ['Watch (yellow)', 0],
      ['Warning (red)', 1],
    ])
  })

  it('knows the same signals and positive words as the app', () => {
    expect(WORD_SIGNALS).toEqual(Object.fromEntries(WORDS.map((w) => [w.id, w.signal])))
    expect([...POSITIVE_WORD_IDS]).toEqual(['strong', 'light'])
  })
})
