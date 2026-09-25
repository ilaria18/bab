// The build (see the precache plugin in vite.config.ts) puts `self.__BUILD__` in front of the copy
// in dist/: an id for this deploy and the hashed files it ships. Without it (tests) the worker
// simply has nothing to precache.
const { id: BUILD_ID, assets: BUILD_ASSETS } = self.__BUILD__ ?? { id: 'dev', assets: [] }

// Everything that belongs to one deploy. The next deploy gets a cache of its own and this one is
// dropped on activate, so files from old deploys never pile up.
const BUILD_CACHE = `build-${BUILD_ID}`
// Fonts, icons and the like: they outlive a deploy, so they are refreshed in place instead.
const RUNTIME_CACHE = 'runtime-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.png', '/icon-192.png', '/icon-512.png']

// How long a page waits on the network before the cached shell is shown instead.
const NAVIGATION_TIMEOUT_MS = 3000

const precache = async () => {
  const cache = await caches.open(BUILD_CACHE)
  await cache.addAll(SHELL)
  // best effort: a file that fails to download must not stop the worker from installing, it is cached on first use instead
  await Promise.allSettled(BUILD_ASSETS.map((url) => cache.add(url)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  const keep = [BUILD_CACHE, RUNTIME_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

const cachePut = async (cacheName, request, response) => {
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

const isBuildAsset = (request) => new URL(request.url).pathname.startsWith('/assets/')

// Pages: network first so a new deploy shows up, cached shell when offline (SPA fallback). On a slow
// connection the shell is shown after a few seconds instead of leaving a blank screen; the request
// keeps going in the background and refreshes the shell for next time.
const handleNavigation = async (request, event) => {
  const network = fetch(request).then((response) => cachePut(BUILD_CACHE, '/index.html', response))
  // keeps the worker alive for that background refresh, and stops a late failure surfacing as unhandled
  event.waitUntil(network.catch(() => {}))
  const timeout = new Promise((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS, null))
  try {
    const response = await Promise.race([network, timeout])
    if (response) return response
    return (await caches.match('/index.html')) ?? network
  } catch {
    return (await caches.match('/index.html')) ?? Response.error()
  }
}

// Hashed build assets never change: cache first. Everything else (fonts, images): serve cached, refresh in background.
const handleAsset = async (request) => {
  const cached = await caches.match(request)
  if (cached && isBuildAsset(request)) return cached
  const refresh = fetch(request).then((response) =>
    cachePut(isBuildAsset(request) ? BUILD_CACHE : RUNTIME_CACHE, request, response),
  )
  if (!cached) return refresh
  // background refresh only: offline it just fails quietly, the cached copy was already served
  refresh.catch(() => {})
  return cached
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return

  // the pilot dashboard and the API are separate pages, never the app's shell
  if (url.origin === self.location.origin && (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api/'))) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request, event))
  } else if (url.origin === self.location.origin || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(handleAsset(request))
  }
})
