import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button, ToggleSwitch } from '@/shared/ui'
import {
  getReminderSettings,
  reminderAvailable,
  saveReminderSettings,
  syncDailyReminder,
  type ReminderSettings,
  type ReminderStatus,
} from './dailyReminder'
import { askWebNotificationPermission } from './webReminder'
import { TrainingRoutineSetting } from './TrainingRoutineSetting'

/** Daily reminder on/off (always at 19:00; on training/match days the notifications around the
 * session instead). Sent only by the native app and the web app installed on the home screen. In a
 * browser tab (e.g. a tutorial on a laptop) the setting is shown as a preview: nothing is scheduled
 * and nothing is sent to the server. */
export const ReminderSetting = ({ available = reminderAvailable() }: { available?: boolean }) => {
  const { t } = useLingui()
  const [settings, setSettings] = useState<ReminderSettings>(getReminderSettings)
  const [status, setStatus] = useState<ReminderStatus | null>(null)

  useEffect(() => {
    if (available) void syncDailyReminder(settings).then(setStatus)
  }, [available, settings])

  const update = (next: ReminderSettings) => {
    saveReminderSettings(next)
    setSettings(next)
  }

  // iPhone only lets a website ask for notifications right after a tap
  const allowNotifications = async () => {
    await askWebNotificationPermission()
    setStatus(await syncDailyReminder(settings))
  }

  const options = [
    { value: 'on', label: t`On` },
    { value: 'off', label: t`Off` },
  ] as const

  return (
    <div className="settings-section">
      <span className="settings-label">
        <Trans>Daily reminder</Trans>
      </span>
      <ToggleSwitch
        options={options}
        value={settings.enabled ? 'on' : 'off'}
        onChange={(value) => update({ ...settings, enabled: value === 'on' })}
      />
      {settings.enabled && (
        <p className="settings-hint">
          <Trans>Every day at 19:00. On training and match days: 3 hours before and 2 hours after.</Trans>
        </p>
      )}
      {settings.enabled && status === 'needs-permission' && (
        <Button onClick={() => void allowNotifications()}>
          <Trans>Allow notifications</Trans>
        </Button>
      )}
      <p className="settings-hint">
        {settings.enabled && status === 'needs-permission' ? (
          <Trans>Tap “Allow notifications” so BAB can send you the reminder.</Trans>
        ) : status === 'blocked' ? (
          <Trans>Notifications are blocked for BAB. Turn them on in your phone's settings.</Trans>
        ) : !available ? (
          <Trans>Preview: notifications arrive only in the app installed on your phone.</Trans>
        ) : null}
      </p>
      {settings.enabled && (
        <TrainingRoutineSetting onChange={() => available && void syncDailyReminder(settings).then(setStatus)} />
      )}
    </div>
  )
}
