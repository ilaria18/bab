import { describe, expect, it } from 'vitest'
import { browserPlatform, isInstalledWebApp } from './platform'

const nav = (userAgent: string, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints }) as Navigator

const win = (displayMode: string | null, standalone?: boolean) =>
  ({
    matchMedia: (query: string) => ({ matches: displayMode !== null && query.includes(displayMode) }),
    navigator: { standalone },
  }) as unknown as Window

describe('platform', () => {
  it('tells iPhone, iPad and Android from a computer', () => {
    expect(browserPlatform(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'))).toBe('ios')
    expect(browserPlatform(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5))).toBe('ios')
    expect(browserPlatform(nav('Mozilla/5.0 (Linux; Android 14; Pixel 6) AppleWebKit/537.36 Chrome/128.0'))).toBe('android')
    expect(browserPlatform(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'))).toBe('web')
    expect(browserPlatform(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0'))).toBe('web')
  })

  it('knows when the website was opened from the home screen', () => {
    expect(isInstalledWebApp(win('standalone'))).toBe(true)
    expect(isInstalledWebApp(win('fullscreen'))).toBe(true)
    expect(isInstalledWebApp(win(null, true))).toBe(true) // older iPhones
    expect(isInstalledWebApp(win('browser'))).toBe(false)
    expect(isInstalledWebApp(win(null))).toBe(false)
  })
})
