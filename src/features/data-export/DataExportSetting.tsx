import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import { dailyLogRepository } from '@/entities/daily-log/dailyLogRepository'
import { wordCardsFor } from '@/i18n'
import { isNativeApp } from '@/shared/lib/platform'
import { todayKey } from '@/shared/lib/dateKey'
import { Button } from '@/shared/ui'
import { buildCsv, participantCode, shareOrDownload, type ShareResult } from './exportData'

type State = 'idle' | 'confirm' | 'working' | ShareResult | 'empty' | 'error'

/**
 * "Your data": the check-ins stay on this phone; at the end of the pilot the athlete can send
 * them as a file, only by her own choice (two taps, and she picks where it goes).
 * Web app only: the native app's WebView has no share menu for files.
 */
export const DataExportSetting = ({ available = !isNativeApp() }: { available?: boolean }) => {
  const [state, setState] = useState<State>('idle')
  if (!available) return null
  const code = participantCode()

  const create = async () => {
    setState('working')
    try {
      const [entries, logs] = await Promise.all([
        checkInRepository.getAll(),
        dailyLogRepository.getRange('0000-01-01', '9999-12-31'),
      ])
      if (entries.length === 0 && logs.length === 0) {
        setState('empty')
        return
      }
      const words = new Map(wordCardsFor('en').map((card) => [card.id, { word: card.word, category: card.category }]))
      const csv = buildCsv(code, entries, logs, words)
      const file = new File([csv], `bab-${code}-${todayKey()}.csv`, { type: 'text/csv' })
      setState(await shareOrDownload(file))
    } catch (error) {
      console.error('Could not create the data file', error)
      setState('error')
    }
  }

  return (
    <div className="settings-section">
      <span className="settings-label">
        <Trans>Your data</Trans>
      </span>
      <p className="settings-hint">
        <Trans>
          Your check-ins are saved only on this phone: don't delete the app during the pilot. At the
          end you can send them to the BAB team as a file, without your name.
        </Trans>
      </p>

      {state === 'confirm' ? (
        <>
          <p className="settings-hint">
            <Trans>
              The file contains your check-ins (words, intensity, energy, body areas, notes) and the
              days of your period and painkillers, with your code {code} instead of your name. You
              choose where to send it; nothing is sent until you do.
            </Trans>
          </p>
          <Button onClick={() => void create()}>
            <Trans>Create the file</Trans>
          </Button>
          <button type="button" className="settings-link-button" onClick={() => setState('idle')}>
            <Trans>Cancel</Trans>
          </button>
        </>
      ) : (
        <Button disabled={state === 'working'} onClick={() => setState('confirm')}>
          <Trans>Send my data</Trans>
        </Button>
      )}

      {state === 'shared' && (
        <p className="settings-hint">
          <Trans>Done, thank you!</Trans>
        </p>
      )}
      {state === 'downloaded' && (
        <p className="settings-hint">
          <Trans>The file was saved in your Downloads: send it to the BAB team from there.</Trans>
        </p>
      )}
      {state === 'empty' && (
        <p className="settings-hint">
          <Trans>There are no check-ins to send yet.</Trans>
        </p>
      )}
      {state === 'error' && (
        <p className="settings-hint">
          <Trans>Something went wrong while creating the file. Please try again.</Trans>
        </p>
      )}
    </div>
  )
}
