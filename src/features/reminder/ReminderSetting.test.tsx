import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@/test/render'
import { ReminderSetting } from './ReminderSetting'

const notifications = vi.hoisted(() => ({
  cancel: vi.fn(async () => {}),
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  requestPermissions: vi.fn(async () => ({ display: 'granted' })),
  schedule: vi.fn(async () => ({ notifications: [] })),
}))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: notifications }))
vi.mock('@/shared/lib/platform', () => ({
  isNativeApp: () => true,
  isInstalledWebApp: () => false,
  appPlatform: () => 'android',
}))

describe('ReminderSetting', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is on at 19:00 by default and schedules a daily notification', async () => {
    render(<ReminderSetting available />)
    await waitFor(() => expect(notifications.schedule).toHaveBeenCalledTimes(1))
    const [{ notifications: [scheduled] }] = notifications.schedule.mock.calls[0] as unknown as [
      { notifications: [{ schedule: unknown }] },
    ]
    expect(scheduled.schedule).toEqual({ on: { hour: 19, minute: 0 }, repeats: true })
  })

  it('cancels the notification when switched off', async () => {
    render(<ReminderSetting available />)
    await waitFor(() => expect(notifications.schedule).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByRole('button', { name: 'Off' }))
    await waitFor(() => expect(notifications.cancel).toHaveBeenCalledTimes(2))
    expect(notifications.schedule).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText('Time')).toBeNull()
  })

  it('tells the athlete when notifications are blocked on the phone', async () => {
    notifications.checkPermissions.mockResolvedValueOnce({ display: 'denied' })
    render(<ReminderSetting available />)
    expect(await screen.findByText(/Notifications are blocked for BAB/)).toBeTruthy()
    expect(notifications.schedule).not.toHaveBeenCalled()
  })
})
