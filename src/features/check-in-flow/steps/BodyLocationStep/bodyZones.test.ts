import { describe, expect, it } from 'vitest'
import { FRONT_ZONES } from './FemaleBodyFront'
import { BACK_ZONES } from './FemaleBodyBack'

describe('body map', () => {
  it('never marks the same zone from the front and the back view', () => {
    expect(FRONT_ZONES.filter((zone) => BACK_ZONES.includes(zone))).toEqual([])
  })
})
