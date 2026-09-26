import { LocalNotifications } from '@capacitor/local-notifications'
import { i18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { isNativeApp } from '@/shared/lib/platform'
import { safeStorage } from '@/shared/lib/safeStorage'
import { recordOpenedFromReminder, recordReminderActive } from '@/features/usage-stats/usageStats'
import {
  disableWebReminder,
  enableWebReminder,
  listenForWebReminderTaps,
  webNotificationPermission,
  webReminderSupported,
} from './webReminder'

/**
 * One notification a day, at a time the athlete can change in Settings.
 * On for everyone by default during the pilot.
 * In the native app it is scheduled on the phone (no server, no push token). In the web app
 * installed on the home screen it is a push notification sent by the server (see webReminder.ts);
 * there the phone first has to allow notifications, which iPhone only lets us ask after a tap.
 */

export type ReminderSettings = { enabled: boolean; time: string } // time as 'HH:MM', local time

/** scheduled · off (switched off) · blocked (notifications refused in the phone's settings) ·
 * needs-permission (web app: the athlete hasn't been asked yet, a tap is needed) ·
 * unavailable (browser tab, computer, or the server could not be reached) */
export type ReminderStatus = 'scheduled' | 'off' | 'blocked' | 'needs-permission' | 'unavailable'

/** Whether this copy of BAB can have a daily reminder: the native app or the installed web app. */
export const reminderAvailable = (): boolean => isNativeApp() || webReminderSupported()

const reminderText = () => ({
  title: 'BAB',
  body: i18n._(msg`How was today? Take a minute to listen to your body.`),
})

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
  if (!isNativeApp()) {
    if (webReminderSupported()) listenForWebReminderTaps(recordOpenedFromReminder)
    return
  }
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    if (notification.id === NOTIFICATION_ID) recordOpenedFromReminder()
  })
}

const applyWebReminder = async (settings: ReminderSettings): Promise<ReminderStatus> => {
  try {
    if (!settings.enabled) {
      await disableWebReminder()
      return 'off'
    }
    const permission = webNotificationPermission()
    if (permission === 'denied') return 'blocked'
    if (permission === 'default') return 'needs-permission'
    await enableWebReminder({ time: settings.time, ...reminderText() })
    return 'scheduled'
  } catch (error) {
    console.error('Could not set up the daily reminder', error)
    return 'unavailable'
  }
}

const applyReminder = async (settings: ReminderSettings): Promise<ReminderStatus> => {
  if (!isNativeApp()) return webReminderSupported() ? applyWebReminder(settings) : 'unavailable'
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
          ...reminderText(),
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
