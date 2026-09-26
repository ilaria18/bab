import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WORKER_SOURCE from '../../../public/sw.js?raw'

const ORIGIN = 'http://app.test'

type Listener = (event: unknown) => void

/** The Cache API in memory: keys are compared by path, like the real one compares URLs. */
const createCaches = () => {
  const stores = new Map<string, Map<string, Response>>()
  const keyOf = (request: string | { url: string }) =>
    new URL(typeof request === 'string' ? request : request.url, ORIGIN).pathname
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      put: async (request: string | { url: string }, response: Response) => void store.set(keyOf(request), response),
      add: async (url: string) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`failed to fetch ${url}`)
        store.set(keyOf(url), response)
      },
      addAll: async (urls: string[]) => {
        for (const url of urls) await (await open(name)).add(url)
      },
    }
  }
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: string | { url: string }) => {
      for (const store of stores.values()) {
        const found = store.get(keyOf(request))
        if (found) return found
      }
      return undefined
    },
  }
}

/** Runs public/sw.js against a fake service worker scope and hands back its event listeners. */
const loadWorker = (build?: { id: string; assets: string[] }) => {
  const listeners: Record<string, Listener> = {}
  const scope = {
    __BUILD__: build,
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => void (listeners[type] = listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(async () => {}) },
  }
  const caches = createCaches()
  new Function('self', 'caches', WORKER_SOURCE)(scope, caches)

  const dispatch = (type: string, extra: object = {}) => {
    const waits: Promise<unknown>[] = []
    let response: Promise<Response> | undefined
    listeners[type]({
      ...extra,
      waitUntil: (promise: Promise<unknown>) => waits.push(promise),
      respondWith: (promise: Promise<Response>) => (response = promise),
    })
    return { response, settled: () => Promise.all(waits) }
  }
  return { caches, scope, dispatch }
}

const navigate = (path = '/calendar') => ({ request: { method: 'GET', mode: 'navigate', url: `${ORIGIN}${path}` } })
const asset = (path: string) => ({ request: { method: 'GET', mode: 'cors', url: `${ORIGIN}${path}` } })
const page = (body: string) => new Response(body, { status: 200 })

describe('service worker', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('install', () => {
    it("caches the shell and this deploy's files in a cache named after the deploy", async () => {
      fetchMock.mockImplementation(async () => page('ok'))
      const { caches, dispatch, scope } = loadWorker({ id: 'abc', assets: ['/assets/a.js', '/assets/b.css'] })

      await dispatch('install').settled()

      expect([...caches.stores.keys()]).toEqual(['build-abc'])
      const cached = [...caches.stores.get('build-abc')!.keys()]
      expect(cached).toEqual(expect.arrayContaining(['/index.html', '/assets/a.js', '/assets/b.css']))
      expect(scope.skipWaiting).toHaveBeenCalled()
    })

    it('still installs when one of the files fails to download', async () => {
      fetchMock.mockImplementation(async (url: string) =>
        url === '/assets/broken.js' ? new Response('nope', { status: 404 }) : page('ok'),
      )
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: ['/assets/broken.js', '/assets/fine.js'] })

      await expect(dispatch('install').settled()).resolves.toBeDefined()

      const cached = [...caches.stores.get('build-abc')!.keys()]
      expect(cached).toContain('/assets/fine.js')
      expect(cached).not.toContain('/assets/broken.js')
    })
  })

  describe('activate', () => {
    it("drops earlier deploys' caches and keeps this one and the runtime cache", async () => {
      const { caches, dispatch, scope } = loadWorker({ id: 'new', assets: [] })
      await caches.open('app-v3')
      await caches.open('build-old')
      await caches.open('build-new')
      await caches.open('runtime-v1')

      await dispatch('activate').settled()

      expect(await caches.keys()).toEqual(['build-new', 'runtime-v1'])
      expect(scope.clients.claim).toHaveBeenCalled()
    })
  })

  describe('navigation', () => {
    it('serves the network page and refreshes the cached shell when the network answers in time', async () => {
      fetchMock.mockResolvedValue(page('fresh'))
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: [] })
      await (await caches.open('build-abc')).put('/index.html', page('stale'))

      const event = dispatch('fetch', navigate())
      expect(await (await event.response)!.text()).toBe('fresh')
      await event.settled()

      expect(await (await caches.match('/index.html'))!.text()).toBe('fresh')
    })

    it('falls back to the cached shell after a few seconds on a slow connection, then refreshes it', async () => {
      vi.useFakeTimers()
      let answer: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)))
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: [] })
      await (await caches.open('build-abc')).put('/index.html', page('stale'))

      const event = dispatch('fetch', navigate())
      await vi.advanceTimersByTimeAsync(3000)
      expect(await (await event.response)!.text()).toBe('stale')

      // the request was left running and still updates the shell for next time
      answer(page('fresh'))
      await event.settled()
      expect(await (await caches.match('/index.html'))!.text()).toBe('fresh')
    })

    it('keeps waiting for the network when there is no cached shell yet', async () => {
      vi.useFakeTimers()
      let answer: (response: Response) => void = () => {}
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => (answer = resolve)))
      const { dispatch } = loadWorker({ id: 'abc', assets: [] })

      const event = dispatch('fetch', navigate())
      await vi.advanceTimersByTimeAsync(10_000)
      answer(page('first visit'))

      expect(await (await event.response)!.text()).toBe('first visit')
    })

    it('serves the cached shell when offline, and an error when there is none', async () => {
      fetchMock.mockRejectedValue(new TypeError('offline'))
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: [] })

      const empty = dispatch('fetch', navigate())
      expect((await empty.response)!.type).toBe('error')
      await empty.settled()

      await (await caches.open('build-abc')).put('/index.html', page('shell'))
      const cached = dispatch('fetch', navigate())
      expect(await (await cached.response)!.text()).toBe('shell')
    })
  })

  describe('assets', () => {
    it('serves hashed build files from the cache without touching the network', async () => {
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: [] })
      await (await caches.open('build-abc')).put('/assets/a.js', page('cached js'))

      const event = dispatch('fetch', asset('/assets/a.js'))

      expect(await (await event.response)!.text()).toBe('cached js')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('stores a hashed file it had to download in the deploy cache, and other files in the runtime cache', async () => {
      fetchMock.mockImplementation(async () => page('downloaded'))
      const { caches, dispatch } = loadWorker({ id: 'abc', assets: [] })

      await (await dispatch('fetch', asset('/assets/late.js')).response)
      await (await dispatch('fetch', asset('/icon-192.png')).response)

      expect([...caches.stores.get('build-abc')!.keys()]).toEqual(['/assets/late.js'])
      expect([...caches.stores.get('runtime-v1')!.keys()]).toEqual(['/icon-192.png'])
    })
  })

  describe('daily reminder', () => {
    it('shows the notification the server sent, replacing the previous one', async () => {
      const { dispatch, scope } = loadWorker()
      const showNotification = vi.fn(async () => {})
      Object.assign(scope, { registration: { showNotification } })

      await dispatch('push', { data: { json: () => ({ title: 'BAB', body: 'Com’è andata oggi?' }) } }).settled()

      expect(showNotification).toHaveBeenCalledWith('BAB', expect.objectContaining({ body: 'Com’è andata oggi?', tag: 'bab-daily-reminder' }))
    })

    it('opens the app marked as opened from the reminder, or tells the open app', async () => {
      const { dispatch, scope } = loadWorker()
      const openWindow = vi.fn(async () => null)
      const matchAll = vi.fn(async (): Promise<unknown[]> => [])
      Object.assign(scope.clients, { matchAll, openWindow })
      const close = vi.fn()

      await dispatch('notificationclick', { notification: { close } }).settled()
      expect(close).toHaveBeenCalled()
      expect(openWindow).toHaveBeenCalledWith('/?reminder=1')

      const open = { url: `${ORIGIN}/calendar`, postMessage: vi.fn(), focus: vi.fn(async () => null) }
      matchAll.mockResolvedValueOnce([open])
      await dispatch('notificationclick', { notification: { close } }).settled()
      expect(open.postMessage).toHaveBeenCalledWith({ type: 'bab-reminder-tap' })
      expect(open.focus).toHaveBeenCalled()
      expect(openWindow).toHaveBeenCalledTimes(1)
    })
  })
})
