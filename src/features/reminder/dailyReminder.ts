import { LocalNotifications } from '@capacitor/local-notifications'
import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isNativeApp } from '@/shared/lib/platform'
import { safeStorage } from '@/shared/lib/safeStorage'
import { recordOpenedFromReminder, recordReminderActive } from '@/features/usage-stats/usageStats'

/**
 * One notification a day, at a time the athlete can change in Settings.
 * On for everyone by default during the pilot; entirely on the phone (no server, no push token).
 */

export type ReminderSettings = { enabled: boolean; time: string } // time as 'HH:MM', local time

/** scheduled · off (switched off) · blocked (notifications refused in the phone's settings) · unavailable (website) */
export type ReminderStatus = 'scheduled' | 'off' | 'blocked' | 'unavailable'

const STORAGE_KEY = 'daily-reminder'
const NOTIFICATION_ID = 1001
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const DEFAULT_REMINDER: ReminderSettings = { enabled: true, time: '19:00' }

export const getReminderSettings = (): ReminderSettings => {
  try {
    const stored = JSON.parse(safeStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ReminderSettings> | null
    if (!stored) return DEFAULT_REMINDER
    return {
      enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULT_REMINDER.enabled,
      time: typeof stored.time === 'string' && TIME.test(stored.time) ? stored.time : DEFAULT_REMINDER.time,
    }
  } catch {
    return DEFAULT_REMINDER
  }
}

export const saveReminderSettings = (settings: ReminderSettings): void =>
  safeStorage.setItem(STORAGE_KEY, JSON.stringify(settings))

/** Makes the phone's scheduled notification match the settings. Called at every start (so the text
 * follows the current language) and whenever the athlete changes the setting. */
export const syncDailyReminder = async (settings = getReminderSettings()): Promise<ReminderStatus> => {
  const status = await applyReminder(settings)
  recordReminderActive(status === 'scheduled')
  return status
}

/** Lets the usage statistics count the visits that started from a tap on the reminder. */
export const listenForReminderTaps = (): void => {
  if (!isNativeApp()) return
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    if (notification.id === NOTIFICATION_ID) recordOpenedFromReminder()
  })
}

const applyReminder = async (settings: ReminderSettings): Promise<ReminderStatus> => {
  if (!isNativeApp()) return 'unavailable'
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] })
    if (!settings.enabled) return 'off'

    const current = await LocalNotifications.checkPermissions()
    const permission =
      current.display === 'granted' || current.display === 'denied'
        ? current.display
        : (await LocalNotifications.requestPermissions()).display
    if (permission !== 'granted') return 'blocked'

    const [hour, minute] = settings.time.split(':').map(Number)
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTIFICATION_ID,
          title: 'BAB',
          body: i18n._(msg`How was today? Take a minute to listen to your body.`),
          schedule: { on: { hour, minute }, repeats: true },
          smallIcon: 'ic_stat_bab',
          iconColor: '#004b4e',
        },
      ],
    })
    return 'scheduled'
  } catch (error) {
    console.error('Could not schedule the daily reminder', error)
    return 'unavailable'
  }
}
