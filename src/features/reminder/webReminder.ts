import { isInstalledWebApp, isNativeApp } from '@/shared/lib/platform'

/**
 * The daily reminder in the web app (the website installed on the home screen), for iPhone
 * (iOS 16.4 or later) and Android. A website can't schedule a notification on the phone, so the
 * phone subscribes to push notifications and the server (api/send-reminders.ts) sends one at
 * the chosen time. The service worker (public/sw.js) shows it.
 */

export const REMINDER_API = '/api/reminder'

/** The phone asks the athlete once; iPhone only allows the question after a tap. */
export type WebPermission = 'granted' | 'denied' | 'default'

export const webReminderSupported = (win: Window = window): boolean =>
  !isNativeApp() &&
  isInstalledWebApp(win) &&
  'serviceWorker' in win.navigator &&
  'PushManager' in win &&
  'Notification' in win

export const webNotificationPermission = (): WebPermission => Notification.permission

/** Must be called straight from a tap (iPhone refuses otherwise). */
export const askWebNotificationPermission = async (): Promise<WebPermission> => Notification.requestPermission()

const base64UrlToBytes = (text: string): Uint8Array<ArrayBuffer> => {
  const base64 = (text + '='.repeat((4 - (text.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const request = (method: string, body: unknown) =>
  fetch(REMINDER_API, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'omit',
  })

export type WebReminder = { time: string; title: string; body: string }

/** Subscribes (once) and tells the server the time and text. Throws if anything fails. */
export const enableWebReminder = async ({ time, title, body }: WebReminder): Promise<void> => {
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    const response = await fetch(REMINDER_API, { credentials: 'omit' })
    if (!response.ok) throw new Error(`reminder key: ${response.status}`)
    const { publicKey } = (await response.json()) as { publicKey: string }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    })
  }
  const response = await request('PUT', {
    subscription: subscription.toJSON(),
    time,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    title,
    body,
  })
  if (!response.ok) throw new Error(`reminder save: ${response.status}`)
}

/** Removes the phone from the server and from the push service. */
export const disableWebReminder = async (): Promise<void> => {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await request('DELETE', { endpoint: subscription.endpoint }).catch(() => undefined)
  await subscription.unsubscribe()
}

/**
 * Counts visits that started from a tap on the web reminder: the service worker opens the app at
 * /?reminder=1, or, if it was already open, sends it a message.
 */
export const listenForWebReminderTaps = (onTap: () => void): void => {
  const url = new URL(window.location.href)
  if (url.searchParams.has('reminder')) {
    onTap()
    url.searchParams.delete('reminder')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }
  navigator.serviceWorker?.addEventListener('message', (event: MessageEvent) => {
    if ((event.data as { type?: string } | null)?.type === 'bab-reminder-tap') onTap()
  })
}
