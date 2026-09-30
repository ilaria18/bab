import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { PageFrame } from '@/shared/layout'
import { Button, Greeting, TabBar } from '@/shared/ui'
import { MAX_MESSAGE, sendFeedback, type FeedbackKind, type FeedbackScreen } from './feedback'
import './FeedbackPage.css'

type State = 'editing' | 'sending' | 'sent' | 'error'

/** Always one tap away (tab bar): tell the BAB team what works, what doesn't, or an idea — anonymously. */
export const FeedbackPage = () => {
  const { t, i18n } = useLingui()
  const [kind, setKind] = useState<FeedbackKind | null>(null)
  const [message, setMessage] = useState('')
  const [screen, setScreen] = useState<FeedbackScreen>('general')
  const [state, setState] = useState<State>('editing')

  const kinds: { value: FeedbackKind; label: string }[] = [
    { value: 'like', label: t`I like it` },
    { value: 'idea', label: t`I have an idea` },
    { value: 'problem', label: t`Something's wrong` },
  ]
  const screens: { value: FeedbackScreen; label: string }[] = [
    { value: 'general', label: t`BAB in general` },
    { value: 'check-in', label: t`Check-in` },
    { value: 'journal', label: t`Journal` },
    { value: 'patterns', label: t`My patterns` },
    { value: 'world', label: t`World` },
    { value: 'reminders', label: t`Notifications` },
    { value: 'settings', label: t`Settings` },
  ]

  const canSend = kind !== null && message.trim().length > 0 && state !== 'sending'

  const send = async () => {
    if (!kind) return
    setState('sending')
    try {
      await sendFeedback({ kind, message, screen, language: i18n.locale })
      setState('sent')
    } catch (error) {
      console.error('Could not send the feedback', error)
      setState('error')
    }
  }

  const reset = () => {
    setKind(null)
    setMessage('')
    setScreen('general')
    setState('editing')
  }

  return (
    <PageFrame>
      <Greeting />
      <div className="feedback-wrapper">
        <h1 className="feedback-title">
          <Trans>Tell us</Trans>
        </h1>
        <p className="feedback-hint">
          <Trans>Anonymous: we don't receive your name. Every message is read by the BAB team.</Trans>
        </p>

        {state === 'sent' ? (
          <div className="feedback-thanks" role="status">
            <p>
              <Trans>Thank you! Your message has reached the BAB team.</Trans>
            </p>
            <button type="button" className="feedback-link" onClick={reset}>
              <Trans>Send another one</Trans>
            </button>
          </div>
        ) : (
          <>
            <div className="feedback-kinds" role="group" aria-label={t`What kind of message?`}>
              {kinds.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="feedback-kind"
                  aria-pressed={kind === option.value}
                  onClick={() => setKind(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="feedback-field">
              <span>
                <Trans>About</Trans>
              </span>
              <select className="feedback-select" value={screen} onChange={(event) => setScreen(event.target.value as FeedbackScreen)}>
                {screens.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="feedback-field">
              <span>
                <Trans>Your message</Trans>
              </span>
              <textarea
                className="feedback-textarea"
                value={message}
                maxLength={MAX_MESSAGE}
                placeholder={t`Write it the way you'd say it…`}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <Button disabled={!canSend} onClick={() => void send()}>
              {state === 'sending' ? t`Sending…` : t`Send`}
            </Button>
            {state === 'error' && (
              <p className="feedback-hint" role="alert">
                <Trans>It didn't go through. Check your connection and try again: your message is still here.</Trans>
              </p>
            )}
          </>
        )}
      </div>
      <TabBar />
    </PageFrame>
  )
}
