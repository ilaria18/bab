import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { ToggleSwitch } from '@/shared/ui'
import { getUsageConsent, setUsageConsent, usageStatsCounted } from './usageStats'

type Choice = 'share' | 'dont-share'

/** Opt-in for the anonymous usage statistics (off until the athlete switches it on).
 * `enabled` is false when the build has no endpoint to send to. In a browser tab or on a computer
 * nothing is ever measured: there (`preview`, e.g. a tutorial on a laptop) the switch is shown but
 * the choice is not saved. (On iPhone the installed app keeps its own data, separate from Safari:
 * a choice made in Safari would not reach it anyway.) */
export const UsageStatsSetting = ({
  enabled = Boolean(import.meta.env.VITE_USAGE_ENDPOINT),
  preview = !usageStatsCounted(),
}: {
  enabled?: boolean
  preview?: boolean
}) => {
  const { t } = useLingui()
  const [choice, setChoice] = useState<Choice>(() => (getUsageConsent() ? 'share' : 'dont-share'))
  if (!enabled) return null

  const options = [
    { value: 'share', label: t`Share` },
    { value: 'dont-share', label: t`Don't share` },
  ] as const

  const change = (next: Choice) => {
    if (!preview) setUsageConsent(next === 'share')
    setChoice(next)
  }

  return (
    <div className="settings-section">
      <span className="settings-label">
        <Trans>Anonymous statistics</Trans>
      </span>
      <ToggleSwitch options={options} value={choice} onChange={change} />
      <p className="settings-hint">
        <Trans>Only how often and how long you open the app, and your training times. Never your check-ins.</Trans>
      </p>
      {preview && (
        <p className="settings-hint">
          <Trans>Preview: statistics are sent only by the app installed on your phone.</Trans>
        </p>
      )}
    </div>
  )
}
