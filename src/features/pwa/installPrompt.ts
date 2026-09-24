import { useSyncExternalStore } from 'react'
import { isNativeApp } from '@/shared/lib/platform'

/** How the user can get the app onto their home screen / desktop:
 * - installed: already running as an installed app
 * - prompt: the browser offers a one-tap install (Chrome/Edge on Android and desktop)
 * - ios-safari: iOS has no install API, the user must use Share → Add to Home Screen
 * - ios-other-browser: on iOS only Safari can install, so send them there
 * - manual: no install API here, point at the browser menu
 * - unavailable: on a computer we don't offer installation at all */
export type InstallStatus =
  'installed' | 'prompt' | 'ios-safari' | 'ios-other-browser' | 'manual' | 'unavailable'

// Chrome's non-standard install event, not in lib.dom
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const listeners = new Set<() => void>()
let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false

const notify = () => listeners.forEach((listener) => listener())

const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac, but a Mac has no touch screen
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isAndroid = (): boolean => /android/i.test(navigator.userAgent)

const isIosSafari = (): boolean => !/crios|fxios|edgios|opios/i.test(navigator.userAgent)

const getStatus = (): InstallStatus => {
  // inside the iOS/Android app there is nothing to install
  if (isNativeApp()) return 'unavailable'
  if (!isIos() && !isAndroid()) return 'unavailable'
  if (installed || isStandalone()) return 'installed'
  if (deferredPrompt) return 'prompt'
  if (isIos()) return isIosSafari() ? 'ios-safari' : 'ios-other-browser'
  return 'manual'
}

/** Call once at startup: the browser fires `beforeinstallprompt` early, often before
 * the Settings page is mounted, so the event has to be caught globally and kept. */
export const listenForInstallPrompt = (): void => {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useInstallApp = () => {
  const status = useSyncExternalStore(subscribe, getStatus)

  const install = async () => {
    if (!deferredPrompt) return
    const promptEvent = deferredPrompt
    // The event can only be used once, whatever the user answers
    deferredPrompt = null
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') installed = true
    notify()
  }

  return { status, install }
}
