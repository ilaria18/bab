import { describe, expect, it } from 'vitest'
import { toRoutineRow } from './usage-routine'

describe('weekly routine rows', () => {
  const session = { day: 1, kind: 'training', start: '18:00', end: '20:00' }
  it('keeps the week, the sessions and the phone type, and nothing else', () => {
    expect(toRoutineRow({ v: 3, kind: 'routine', week: '2026-W41', sessions: [{ ...session, place: 'gym' }], platform: 'ios', name: 'Giulia' }))
      .toEqual({ week: '2026-W41', sessions: [session], platform: 'ios' })
    expect(toRoutineRow({ v: 3, kind: 'routine', week: '2026-W41', sessions: [], platform: 'web' })?.sessions).toEqual([])
  })
  it('refuses anything malformed', () => {
    expect(toRoutineRow({ v: 3, kind: 'routine', week: '41', sessions: [], platform: 'web' })).toBeNull()
    expect(toRoutineRow({ v: 3, kind: 'routine', week: '2026-W41', sessions: [{ ...session, day: 9 }], platform: 'web' })).toBeNull()
    expect(toRoutineRow({ v: 3, kind: 'routine', week: '2026-W41', sessions: Array(15).fill(session), platform: 'web' })).toBeNull()
    expect(toRoutineRow({ v: 3, day: '2026-10-05' })).toBeNull()
  })
})
