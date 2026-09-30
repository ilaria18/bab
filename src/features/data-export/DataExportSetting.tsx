import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import { dailyLogRepository } from '@/entities/daily-log/dailyLogRepository'
import { wordCardsFor } from '@/i18n'
import { getTrainingRoutine } from '@/features/reminder/trainingRoutine'
import { isNativeApp } from '@/shared/lib/platform'
import { Button } from '@/shared/ui'
import { buildRows, deleteResearchData, lastSentAt, participantCode, sendResearchData } from './researchData'

type State = 'idle' | 'confirm' | 'working' | 'sent' | 'confirm-delete' | 'deleted' | 'empty' | 'error'

/**
 * "Your data": the check-ins stay on this phone; the athlete can send them to the BAB research
 * database, only by her own choice (two taps), send them again to update them, or delete what
 * she sent. Web app only (the pilot runs on it).
 */
export const DataExportSetting = ({ available = !isNativeApp() }: { available?: boolean }) => {
  const { i18n } = useLingui()
  const [state, setState] = useState<State>('idle')
  const [sentAt, setSentAt] = useState(lastSentAt)
  if (!available) return null
  const code = participantCode()

  const send = async () => {
    setState('working')
    try {
      const [entries, logs] = await Promise.all([
        checkInRepository.getAll(),
        dailyLogRepository.getRange('0000-01-01', '9999-12-31'),
      ])
      const words = new Map(wordCardsFor('en').map((card) => [card.id, { word: card.word, category: card.category }]))
      const rows = buildRows(entries, logs, words)
      if (rows.length === 0) {
        setState('empty')
        return
      }
      await sendResearchData(rows, getTrainingRoutine())
      setSentAt(lastSentAt())
      setState('sent')
    } catch (error) {
      console.error('Could not send the data', error)
      setState('error')
    }
  }

  const remove = async () => {
    setState('working')
    try {
      await deleteResearchData()
      setSentAt(null)
      setState('deleted')
    } catch (error) {
      console.error('Could not delete the data', error)
      setState('error')
    }
  }

  const sentDate = sentAt ? i18n.date(new Date(sentAt), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="settings-section">
      <span className="settings-label">
        <Trans>Your data</Trans>
      </span>
      <p className="settings-hint">
        <Trans>Saved only on this phone: don't delete the app. Send them to BAB without your name.</Trans>
      </p>

      {state === 'confirm' && (
        <>
          <p className="settings-hint">
            <Trans>
              Your check-ins (notes included), your period and painkiller days and your training and match times
              go to BAB with the code {code} instead of your name. You can delete them at any time.
            </Trans>
          </p>
          <Button onClick={() => void send()}>
            <Trans>Yes, send</Trans>
          </Button>
          <button type="button" className="settings-link-button" onClick={() => setState('idle')}>
            <Trans>Cancel</Trans>
          </button>
        </>
      )}

      {state === 'confirm-delete' && (
        <>
          <p className="settings-hint">
            <Trans>Delete the data you sent from the BAB database? Your check-ins stay on this phone.</Trans>
          </p>
          <Button onClick={() => void remove()}>
            <Trans>Yes, delete</Trans>
          </Button>
          <button type="button" className="settings-link-button" onClick={() => setState('idle')}>
            <Trans>Cancel</Trans>
          </button>
        </>
      )}

      {state !== 'confirm' && state !== 'confirm-delete' && (
        <Button disabled={state === 'working'} onClick={() => setState('confirm')}>
          {sentAt ? <Trans>Send my data again</Trans> : <Trans>Send my data</Trans>}
        </Button>
      )}

      {sentDate && state !== 'confirm-delete' && (
        <>
          <p className="settings-hint">
            <Trans>Last sent: {sentDate}</Trans>
          </p>
          <button type="button" className="settings-link-button" onClick={() => setState('confirm-delete')}>
            <Trans>Delete the data I sent</Trans>
          </button>
        </>
      )}

      {state === 'sent' && (
        <p className="settings-hint">
          <Trans>Sent, thank you!</Trans>
        </p>
      )}
      {state === 'deleted' && (
        <p className="settings-hint">
          <Trans>Your data has been deleted from the BAB database.</Trans>
        </p>
      )}
      {state === 'empty' && (
        <p className="settings-hint">
          <Trans>There are no check-ins to send yet.</Trans>
        </p>
      )}
      {state === 'error' && (
        <p className="settings-hint">
          <Trans>Something went wrong. Check your connection and try again.</Trans>
        </p>
      )}
    </div>
  )
}
