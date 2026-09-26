import { describe, expect, it } from 'vitest'
import { insetsCountedTwice } from './safeArea'

describe('insetsCountedTwice', () => {
  it('ignores the insets of an Android phone that draws the app between its bars', () => {
    // 3-button navigation: the page is the screen minus the status bar (24) and the nav bar (48)
    expect(insetsCountedTwice({ top: 24, bottom: 48 }, { width: 400, height: 817 }, { width: 400, height: 889 })).toBe(true)
  })

  it('keeps them when the app is drawn under the bars (iPhone, Android edge-to-edge)', () => {
    expect(insetsCountedTwice({ top: 47, bottom: 34 }, { width: 390, height: 844 }, { width: 390, height: 844 })).toBe(false)
    expect(insetsCountedTwice({ top: 24, bottom: 24 }, { width: 412, height: 915 }, { width: 412, height: 915 })).toBe(false)
  })

  it('has nothing to do when no insets are reported, and handles landscape', () => {
    expect(insetsCountedTwice({ top: 0, bottom: 0 }, { width: 400, height: 817 }, { width: 400, height: 889 })).toBe(false)
    expect(insetsCountedTwice({ top: 24, bottom: 0 }, { width: 889, height: 376 }, { width: 400, height: 889 })).toBe(true)
  })
})
