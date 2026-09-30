import { describe, expect, it } from 'vitest'
import { routineSlots } from './trainingRoutine'

describe('routineSlots', () => {
  it('puts a notification 3 hours before and 2 hours after each session', () => {
    expect(
      routineSlots([
        { day: 1, kind: 'training', start: '18:00', end: '20:00' },
        { day: 6, kind: 'match', start: '17:30', end: '19:30' },
      ]),
    ).toEqual({
      slots: [
        { dow: 1, time: '15:00', type: 'pre_training' },
        { dow: 1, time: '22:00', type: 'post_training' },
        { dow: 6, time: '14:30', type: 'pre_match' },
        { dow: 6, time: '21:30', type: 'post_match' },
      ],
      sessionDays: [1, 6],
    })
  })

  it('moves notifications across midnight to the right day', () => {
    // a session at 01:00 on Monday: its "before" lands on Sunday evening
    expect(routineSlots([{ day: 1, kind: 'training', start: '01:00', end: '02:00' }]).slots).toEqual([
      { dow: 1, time: '04:00', type: 'post_training' },
      { dow: 7, time: '22:00', type: 'pre_training' }, // Sunday evening
    ])
    // a match ending after midnight on Sunday: "after" lands on Monday
    expect(routineSlots([{ day: 7, kind: 'match', start: '21:00', end: '23:30' }]).slots).toEqual([
      { dow: 1, time: '01:30', type: 'post_match' },
      { dow: 7, time: '18:00', type: 'pre_match' },
    ])
  })

  it('is empty without a routine (daily reminder only)', () => {
    expect(routineSlots([])).toEqual({ slots: [], sessionDays: [] })
  })
})
