/** Registers the offline/installability service worker (public/sw.js).
 * Prod only: in dev it would cache Vite's modules and hide code changes.
 *
 * New deploys: every time the app comes back to the screen it asks for a new sw.js; when a new
 * version takes over, the page reloads itself the next time it is out of sight (switching app,
 * locking the phone, changing tab), so nobody is interrupted mid check-in and nobody needs to
 * "close and reopen twice" to see the update. */
export const registerServiceWorker = (): void => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // no controller yet = first visit: the first worker taking over is not an update
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloadWhenHidden = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadWhenHidden) return
    reloadWhenHidden = true
    if (document.visibilityState === 'hidden') window.location.reload()
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden' && reloadWhenHidden) window.location.reload()
          if (document.visibilityState === 'visible') void registration.update().catch(() => {})
        })
      })
      .catch((error) => {
        console.error('Service worker registration failed', error)
      })
  })
}
