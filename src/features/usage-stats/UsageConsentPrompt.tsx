import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { Button } from '@/shared/ui'
import { hasAnsweredUsageConsent, setUsageConsent, usageStatsCounted } from './usageStats'
import './UsageConsentPrompt.css'

/**
 * Asked once, the first time the installed app is opened: share the anonymous usage statistics?
 * Nothing is collected until the athlete taps "Yes, share"; "No, thanks" keeps it off. Either way
 * the question doesn't come back, and the choice can be changed in Settings.
 * `available` is false where nothing would be measured (browser tab, computer, no endpoint).
 */
export const UsageConsentPrompt = ({
  available = Boolean(import.meta.env.VITE_USAGE_ENDPOINT) && usageStatsCounted(),
}: {
  available?: boolean
}) => {
  const [open, setOpen] = useState(() => available && !hasAnsweredUsageConsent())
  if (!open) return null

  const answer = (share: boolean) => {
    setUsageConsent(share)
    setOpen(false)
  }

  return (
    <div className="consent-prompt-backdrop">
      <div className="consent-prompt" role="dialog" aria-modal="true" aria-labelledby="consent-prompt-title">
        <h2 id="consent-prompt-title" className="consent-prompt__title">
          <Trans>Share anonymous statistics?</Trans>
        </h2>
        <p className="consent-prompt__text">
          <Trans>
            Help us improve BAB: the app only sends how often and for how long it is opened, day by
            day, and the days and times of your training and matches. Never your check-ins, never your
            name, never anything that identifies you or your phone.
          </Trans>
        </p>
        <div className="consent-prompt__actions">
          <Button onClick={() => answer(true)}>
            <Trans>Yes, share</Trans>
          </Button>
          <button type="button" className="consent-prompt__decline" onClick={() => answer(false)}>
            <Trans>No, thanks</Trans>
          </button>
        </div>
        <p className="consent-prompt__hint">
          <Trans>You can change your choice at any time in Settings.</Trans>
        </p>
      </div>
    </div>
  )
}
