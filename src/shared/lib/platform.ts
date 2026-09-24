import { Capacitor } from '@capacitor/core'

export type AppPlatform = 'ios' | 'android' | 'web'

/** true inside the iOS/Android app built with Capacitor, false in a browser (and in tests) */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

export const appPlatform = (): AppPlatform => {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}
