import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'ios' | 'android' | 'web'

/** true inside the iOS/Android app built with Capacitor, false in a browser (and in tests) */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

/**
 * true when the website was opened from its icon on the home screen ("Add to Home Screen" /
 * "Install app"), false in an ordinary browser tab.
 */
export const isInstalledWebApp = (win: Window = window): boolean => {
  const mode = (query: string) => (typeof win.matchMedia === 'function' ? win.matchMedia(query).matches : false)
  return (
    mode('(display-mode: standalone)') ||
    mode('(display-mode: fullscreen)') ||
    // older iPhones only expose this
    (win.navigator as (Navigator & { standalone?: boolean }) | undefined)?.standalone === true
  )
}

/** iPhone/iPad or Android phone, read from the browser; 'web' for a computer */
export const browserPlatform = (nav: Navigator = navigator): AppPlatform => {
  const ua = nav.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  // iPads ask for the desktop site and say "Macintosh": a touch screen gives them away
  if (/macintosh/i.test(ua) && nav.maxTouchPoints > 1) return 'ios'
  return 'web'
}

/** ios / android for the native app and for the website on a phone, web on a computer */
export const appPlatform = (): AppPlatform => {
  if (isNativeApp()) {
    const platform = Capacitor.getPlatform()
    return platform === 'ios' || platform === 'android' ? platform : 'web'
  }
  return browserPlatform()
}
