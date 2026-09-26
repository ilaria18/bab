import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ToggleSwitch } from '@/shared/ui'
import { getUsageConsent, setUsageConsent, usageStatsCounted } from './usageStats'

type Choice = 'share' | 'dont-share'

/** Opt-in for the anonymous usage statistics (off until the athlete switches it on).
 * `enabled` is false when there is nothing to ask: the build has no endpoint to send to, or BAB is
 * open in a browser tab or on a computer, where nothing is measured. (On iPhone the installed app
 * keeps its own data, separate from Safari: a choice made in Safari would not reach it.) */
export const UsageStatsSetting = ({
  enabled = Boolean(import.meta.env.VITE_USAGE_ENDPOINT) && usageStatsCounted(),
}: {
  enabled?: boolean
}) => {
  const { t } = useLingui()
  const [choice, setChoice] = useState<Choice>(() => (getUsageConsent() ? 'share' : 'dont-share'))
  if (!enabled) return null

  const options = [
    { value: 'share', label: t`Share` },
    { value: 'dont-share', label: t`Don't share` },
  ] as const

  const change = (next: Choice) => {
    setUsageConsent(next === 'share')
    setChoice(next)
  }

  return (
    <div className="settings-section">
      <span className="settings-label">
        <Trans>Anonymous statistics</Trans>
      </span>
      <ToggleSwitch options={options} value={choice} onChange={change} />
      <p className="settings-hint">
        <Trans>
          Help us improve BAB: the app only sends how often and for how long it is opened, day by
          day. Never what you record, never your name, never anything that identifies you or your
          phone.
        </Trans>
      </p>
    </div>
  )
}
