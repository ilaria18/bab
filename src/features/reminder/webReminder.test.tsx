import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/test/render'
import { ReminderSetting } from './ReminderSetting'

vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {} }))
// the website opened from the home screen of an iPhone
vi.mock('@/shared/lib/platform', () => ({
  isNativeApp: () => false,
  isInstalledWebApp: () => true,
  appPlatform: () => 'ios',
}))

describe('ReminderSetting in the web app', () => {
  const notification = {
    permission: 'default' as NotificationPermission,
    requestPermission: vi.fn(async (): Promise<NotificationPermission> => (notification.permission = 'granted')),
  }
  const subscription = {
    endpoint: 'https://web.push.apple.com/abc',
    toJSON: () => ({ endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  }
  const pushManager = {
    getSubscription: vi.fn(async (): Promise<typeof subscription | null> => null),
    subscribe: vi.fn(async () => subscription),
  }
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method ? new Response('{}') : Response.json({ publicKey: 'BAAA' }),
  )
  const bodyOf = (method: string) =>
    JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === method)![1]!.body)) as Record<string, unknown>
  class FakePushManager {}

  beforeEach(() => {
    vi.clearAllMocks()
    notification.permission = 'default'
    pushManager.getSubscription.mockResolvedValue(null)
    vi.stubGlobal('Notification', notification)
    vi.stubGlobal('PushManager', FakePushManager)
    vi.stubGlobal('fetch', fetchMock)
    Object.assign(window, { Notification: notification, PushManager: FakePushManager })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        ready: Promise.resolve({ pushManager }),
        getRegistration: async () => ({ pushManager }),
        addEventListener: () => {},
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (window as { Notification?: unknown }).Notification
    delete (window as { PushManager?: unknown }).PushManager
    delete (navigator as { serviceWorker?: unknown }).serviceWorker
  })

  it('asks for notifications on a tap, then registers the 19:00 reminder with the server', async () => {
    render(<ReminderSetting />)
    await userEvent.click(await screen.findByRole('button', { name: 'Allow notifications' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/reminder', expect.objectContaining({ method: 'PUT' })))
    expect(notification.requestPermission).toHaveBeenCalledTimes(1)
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(bodyOf('PUT')).toMatchObject({
      subscription: { endpoint: 'https://web.push.apple.com/abc' },
      time: '19:00',
      title: 'BAB',
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Allow notifications' })).toBeNull())
  })

  it('removes the phone from the server when switched off', async () => {
    notification.permission = 'granted'
    pushManager.getSubscription.mockResolvedValue(subscription)
    render(<ReminderSetting />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/reminder', expect.objectContaining({ method: 'PUT' })))

    await userEvent.click(screen.getByRole('button', { name: 'Off' }))

    await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled())
    expect(bodyOf('DELETE')).toEqual({ endpoint: 'https://web.push.apple.com/abc' })
  })

  it('tells the athlete when notifications are blocked', async () => {
    notification.permission = 'denied'
    render(<ReminderSetting />)
    expect(await screen.findByText(/Notifications are blocked for BAB/)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
