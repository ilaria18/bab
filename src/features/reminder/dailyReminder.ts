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
import { getTrainingRoutine, routineSlots, type IsoWeekday, type SlotType } from './trainingRoutine'

/**
 * One notification a day, at a time the athlete can change in Settings.
 * On for everyone by default during the pilot.
 * If she enters her weekly training/match routine (trainingRoutine.ts), days with a session get a
 * notification 3 hours before and one 2 hours after it instead of the daily one.
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

/** texts of the training/match notifications, in the current language */
const slotTexts = (): Record<SlotType, { title: string; body: string }> => ({
  pre_training: { title: 'BAB', body: i18n._(msg`Training in 3 hours: how is your body arriving? Take a minute for a check-in.`) },
  post_training: { title: 'BAB', body: i18n._(msg`How did training go? Listen to your body and do a check-in.`) },
  pre_match: { title: 'BAB', body: i18n._(msg`Match in 3 hours: how is your body arriving? Take a minute for a check-in.`) },
  post_match: { title: 'BAB', body: i18n._(msg`How did the match go? Listen to your body and do a check-in.`) },
})

const STORAGE_KEY = 'daily-reminder'
const NOTIFICATION_ID = 1001
/** native app with a routine: the daily reminder on each day without a session (weekly, one per weekday) */
const WEEKDAY_REMINDER_ID = 1100
/** native app: the training/match notifications */
const SLOT_ID = 1200
const MAX_SLOTS = 60
const ALL_IDS = [
  NOTIFICATION_ID,
  ...Array.from({ length: 7 }, (_, i) => WEEKDAY_REMINDER_ID + 1 + i),
  ...Array.from({ length: MAX_SLOTS }, (_, i) => SLOT_ID + 1 + i),
]
const isReminderId = (id: number) => ALL_IDS.includes(id)
/** Capacitor counts weekdays from Sunday = 1 */
const capacitorWeekday = (dow: IsoWeekday) => (dow % 7) + 1
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

/**
 * A tap on the reminder: counted in the usage statistics, and `onTap` brings the athlete to the
 * home screen (otherwise the app would reopen on whatever page it was left on).
 */
export const listenForReminderTaps = (onTap: () => void = () => {}): void => {
  const tapped = () => {
    recordOpenedFromReminder()
    onTap()
  }
  if (!isNativeApp()) {
    if (webReminderSupported()) listenForWebReminderTaps(tapped)
    return
  }
  void LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    if (isReminderId(notification.id)) tapped()
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
    await enableWebReminder({ time: settings.time, ...reminderText(), ...routineSlots(getTrainingRoutine()), texts: slotTexts() })
    return 'scheduled'
  } catch (error) {
    console.error('Could not set up the daily reminder', error)
    return 'unavailable'
  }
}

const applyReminder = async (settings: ReminderSettings): Promise<ReminderStatus> => {
  if (!isNativeApp()) return webReminderSupported() ? applyWebReminder(settings) : 'unavailable'
  try {
    await LocalNotifications.cancel({ notifications: ALL_IDS.map((id) => ({ id })) })
    if (!settings.enabled) return 'off'

    const current = await LocalNotifications.checkPermissions()
    const permission =
      current.display === 'granted' || current.display === 'denied'
        ? current.display
        : (await LocalNotifications.requestPermissions()).display
    if (permission !== 'granted') return 'blocked'

    const [hour, minute] = settings.time.split(':').map(Number)
    const look = { smallIcon: 'ic_stat_bab', iconColor: '#004b4e' }
    const { slots, sessionDays } = routineSlots(getTrainingRoutine())
    if (sessionDays.length === 0) {
      await LocalNotifications.schedule({
        notifications: [
          { id: NOTIFICATION_ID, ...reminderText(), schedule: { on: { hour, minute }, repeats: true }, ...look },
        ],
      })
      return 'scheduled'
    }
    const texts = slotTexts()
    const restDays = ([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[]).filter((day) => !sessionDays.includes(day))
    await LocalNotifications.schedule({
      notifications: [
        ...restDays.map((day) => ({
          id: WEEKDAY_REMINDER_ID + day,
          ...reminderText(),
          schedule: { on: { weekday: capacitorWeekday(day), hour, minute }, repeats: true },
          ...look,
        })),
        ...slots.slice(0, MAX_SLOTS).map((slot, i) => {
          const [slotHour, slotMinute] = slot.time.split(':').map(Number)
          return {
            id: SLOT_ID + 1 + i,
            ...texts[slot.type],
            schedule: { on: { weekday: capacitorWeekday(slot.dow), hour: slotHour, minute: slotMinute }, repeats: true },
            ...look,
          }
        }),
      ],
    })
    return 'scheduled'
  } catch (error) {
    console.error('Could not schedule the daily reminder', error)
    return 'unavailable'
  }
}
