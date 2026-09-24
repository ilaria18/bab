import { Preferences } from '@capacitor/preferences'
import { isNativeApp } from './platform'

/**
 * Key/value storage for everything the app keeps on the device.
 *
 * In a browser it is localStorage. In the iOS/Android app it is Capacitor Preferences
 * (UserDefaults / SharedPreferences), which the system never clears on its own — unlike the
 * WebView's localStorage, which iOS may wipe when the phone is short of space.
 *
 * Preferences is async while the rest of the app reads synchronously, so in the app every value
 * is loaded into memory once at startup (hydrateStorage, awaited in main.tsx before the first
 * render); reads come from memory and writes go to memory and, in the background, to Preferences.
 *
 * localStorage access throws in some contexts (Safari private mode, blocked site data,
 * sandboxed iframes) — the app should keep working, just without persistence.
 */

const memory = new Map<string, string>()
let native = false

/** Call once before anything reads storage. */
export const hydrateStorage = async (): Promise<void> => {
  native = isNativeApp()
  if (!native) return
  try {
    const { keys } = await Preferences.keys()
    const values = await Promise.all(keys.map((key) => Preferences.get({ key })))
    keys.forEach((key, i) => {
      const value = values[i].value
      if (value !== null) memory.set(key, value)
    })
    // data written to the WebView's localStorage by an earlier build of the app: move it over once
    const oldKeys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i))
    for (const key of oldKeys) {
      if (key === null) continue
      const value = window.localStorage.getItem(key)
      if (value !== null && !memory.has(key)) {
        memory.set(key, value)
        await Preferences.set({ key, value })
      }
      window.localStorage.removeItem(key)
    }
  } catch (error) {
    console.error('Could not load stored data', error)
  }
}

export const safeStorage = {
  getItem: (key: string): string | null => {
    if (native) return memory.get(key) ?? null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (native) {
      memory.set(key, value)
      Preferences.set({ key, value }).catch((error) => console.error('Could not save', key, error))
      return
    }
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // storage unavailable or full: drop the write
    }
  },
}
