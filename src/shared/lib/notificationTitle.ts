/**
 * The title of the web app's notifications, with the athlete's name ("Hi, Giulia").
 * The name never goes to the server: the server sends "BAB", and the service worker (public/sw.js)
 * swaps in this title, which is kept on the phone in the service worker's cache storage.
 */
export const PROFILE_CACHE = 'bab-profile'
export const NOTIFICATION_TITLE_URL = '/__bab/notification-title'

/** null removes it: the notifications go back to "BAB" */
export const saveNotificationTitle = async (title: string | null): Promise<void> => {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(PROFILE_CACHE)
    if (title) {
      await cache.put(NOTIFICATION_TITLE_URL, new Response(JSON.stringify({ title: title.slice(0, 60) }), { headers: { 'Content-Type': 'application/json' } }))
    } else {
      await cache.delete(NOTIFICATION_TITLE_URL)
    }
  } catch {
    // private mode or storage blocked: the notifications just say "BAB"
  }
}
