import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { i18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { RouterProvider } from 'react-router-dom'
import './styles/tokens.css'
import './index.css'
import { preloadRoutes, router } from './router.tsx'
import { DEFAULT_LOCALE } from './i18n'
import { activateLocale, getInitialLocale } from './i18n/runtime'
import { applyTheme, getInitialTheme } from './features/theme/theme'
import { registerServiceWorker } from './features/pwa/registerServiceWorker'
import { listenForInstallPrompt } from './features/pwa/installPrompt'
import { startUsageStats } from './features/usage-stats/usageStats'
import { hydrateStorage } from './shared/lib/safeStorage'
import { isNativeApp } from './shared/lib/platform'

const isNative = isNativeApp()

const start = async () => {
  // in the iOS/Android app stored data is loaded asynchronously: nothing may read it before this
  await hydrateStorage()
  applyTheme(getInitialTheme())
  // the service worker and the install prompt only make sense for the website, not inside the app
  if (!isNative) {
    registerServiceWorker()
    listenForInstallPrompt()
  } else if ('serviceWorker' in navigator) {
    // a worker left by an earlier build of the app would keep serving old files after an update
    void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()))
  }
  startUsageStats()

  // The catalog has to be loaded before the first render, or the UI would flash untranslated.
  // If the chosen language's catalog can't be fetched (offline), open in the default one instead.
  await activateLocale(getInitialLocale()).catch(() => activateLocale(DEFAULT_LOCALE))

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <RouterProvider router={router} />
      </I18nProvider>
      {/* Vercel's page-view counter only works on the website's own domain */}
      {!isNative && <Analytics />}
    </StrictMode>,
  )
  // once the first screen is up and the browser is idle, fetch the other screens
  if ('requestIdleCallback' in window) window.requestIdleCallback(preloadRoutes)
  else setTimeout(preloadRoutes, 1000)
}

void start()
