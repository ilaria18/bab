import { useEffect, useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ToggleSwitch } from '@/shared/ui'
import { isNativeApp } from '@/shared/lib/platform'
import {
  getReminderSettings,
  saveReminderSettings,
  syncDailyReminder,
  type ReminderSettings,
  type ReminderStatus,
} from './dailyReminder'

/** Daily reminder on/off and its time. Only inside the iOS/Android app. */
export const ReminderSetting = ({ available = isNativeApp() }: { available?: boolean }) => {
  const { t } = useLingui()
  const [settings, setSettings] = useState<ReminderSettings>(getReminderSettings)
  const [status, setStatus] = useState<ReminderStatus | null>(null)

  useEffect(() => {
    if (available) void syncDailyReminder(settings).then(setStatus)
  }, [available, settings])

  if (!available) return null

  const update = (next: ReminderSettings) => {
    saveReminderSettings(next)
    setSettings(next)
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
        <label className="settings-reminder-time">
          <span>
            <Trans>Time</Trans>
          </span>
          <input
            className="settings-name-input"
            type="time"
            value={settings.time}
            onChange={(event) => {
              if (event.target.value) update({ ...settings, time: event.target.value })
            }}
          />
        </label>
      )}
      <p className="settings-hint">
        {status === 'blocked' ? (
          <Trans>Notifications are blocked for BAB. Turn them on in your phone's settings.</Trans>
        ) : (
          <Trans>A notification every day at the time you choose.</Trans>
        )}
      </p>
    </div>
  )
}
