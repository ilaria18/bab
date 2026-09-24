import { Trans, useLingui } from '@lingui/react/macro'
import { PageFrame } from '@/shared/layout'
import { Button, Greeting, TabBar, ToggleSwitch } from '@/shared/ui'
import { useTheme } from '@/features/theme/useTheme'
import { useInstallApp } from '@/features/pwa/installPrompt'
import { useUserProfile } from '@/entities/user-profile/useUserProfile'
import { LANGUAGE_SELECTION_ENABLED } from '@/i18n'
import { UsageStatsSetting } from '@/features/usage-stats/UsageStatsSetting'
import { ReminderSetting } from '@/features/reminder/ReminderSetting'
import { LanguagePicker } from './LanguagePicker'
import './SettingsPage.css'

export const SettingsPage = () => {
  const { t } = useLingui()
  const { theme, setTheme } = useTheme()
  const { name, setName } = useUserProfile()
  const { status: installStatus, install } = useInstallApp()
  const themeOptions = [
    { value: 'light', label: t`Light` },
    { value: 'dark', label: t`Dark` },
  ] as const

  return (
    <PageFrame>
      <Greeting />
      <div className="settings-wrapper">
        <div className="settings-header">
          <h1 className="settings-title">
            <Trans>Settings</Trans>
          </h1>
        </div>

        <div className="settings-section">
          <label className="settings-label" htmlFor="settings-name">
            <Trans>Your name</Trans>
          </label>
          <input
            id="settings-name"
            className="settings-name-input"
            type="text"
            maxLength={30}
            autoComplete="given-name"
            value={name}
            placeholder={t`Champ`}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {LANGUAGE_SELECTION_ENABLED && <LanguagePicker />}

        <div className="settings-section">
          <span className="settings-label">
            <Trans>Theme</Trans>
          </span>
          <ToggleSwitch options={themeOptions} value={theme} onChange={setTheme} />
        </div>

        <ReminderSetting />

        <UsageStatsSetting />

        {installStatus !== 'unavailable' && (
          <div className="settings-section">
            <span className="settings-label">
              <Trans>Install app</Trans>
            </span>
            {installStatus === 'installed' && (
              <p className="settings-hint">
                <Trans>The app is installed on this device.</Trans>
              </p>
            )}
            {installStatus === 'prompt' && (
              <Button onClick={install}>
                <Trans>Install app</Trans>
              </Button>
            )}
            {installStatus === 'ios-safari' && (
              <ol className="settings-hint settings-steps">
                <li>
                  <Trans>Tap the Share button in Safari's toolbar.</Trans>
                </li>
                <li>
                  <Trans>Choose “Add to Home Screen”.</Trans>
                </li>
                <li>
                  <Trans>Tap “Add”.</Trans>
                </li>
              </ol>
            )}
            {installStatus === 'ios-other-browser' && (
              <p className="settings-hint">
                <Trans>
                  On iPhone and iPad the app can only be installed from Safari. Open this page in
                  Safari, then tap Share → “Add to Home Screen”.
                </Trans>
              </p>
            )}
            {installStatus === 'manual' && (
              <p className="settings-hint">
                <Trans>
                  Open your browser menu and choose “Install app” (or “Add to Dock” in Safari on
                  Mac).
                </Trans>
              </p>
            )}
          </div>
        )}
      </div>
      <TabBar />
    </PageFrame>
  )
}
