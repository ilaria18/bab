import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import {
  getTrainingRoutine,
  MAX_SESSIONS,
  saveTrainingRoutine,
  type IsoWeekday,
  type Session,
  type SessionKind,
} from './trainingRoutine'
import './TrainingRoutineSetting.css'

const DAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]
/** a Monday, to name the weekdays in the current language */
const A_MONDAY = new Date(2026, 0, 5)

/**
 * The weekly routine of training sessions and matches, entered by the athlete (optional).
 * On those days she gets a notification 3 hours before and one 2 hours after each session,
 * instead of the daily reminder. `onChange` reschedules the notifications.
 */
export const TrainingRoutineSetting = ({ onChange }: { onChange: () => void }) => {
  const { t, i18n } = useLingui()
  const [sessions, setSessions] = useState<Session[]>(getTrainingRoutine)

  const update = (next: Session[]) => {
    saveTrainingRoutine(next)
    setSessions(next)
    onChange()
  }
  const change = (index: number, patch: Partial<Session>) =>
    update(sessions.map((session, i) => (i === index ? { ...session, ...patch } : session)))

  const dayName = (day: IsoWeekday) =>
    i18n.date(new Date(A_MONDAY.getTime() + (day - 1) * 86_400_000), { weekday: 'long' })

  return (
    <div className="training-routine">
      <span className="settings-label">
        <Trans>Training and matches</Trans>
      </span>

      {sessions.map((session, index) => (
        <div key={index} className="training-routine__session">
          <select
            className="settings-select training-routine__day"
            aria-label={t`Day`}
            value={session.day}
            onChange={(event) => change(index, { day: Number(event.target.value) as IsoWeekday })}
          >
            {DAYS.map((day) => (
              <option key={day} value={day}>
                {dayName(day)}
              </option>
            ))}
          </select>
          <select
            className="settings-select training-routine__kind"
            aria-label={t`Type`}
            value={session.kind}
            onChange={(event) => change(index, { kind: event.target.value as SessionKind })}
          >
            <option value="training">{t`Training`}</option>
            <option value="match">{t`Match`}</option>
          </select>
          <input
            className="settings-name-input training-routine__start"
            type="time"
            aria-label={t`Start`}
            value={session.start}
            onChange={(event) => event.target.value && change(index, { start: event.target.value })}
          />
          <input
            className="settings-name-input training-routine__end"
            type="time"
            aria-label={t`End`}
            value={session.end}
            onChange={(event) => event.target.value && change(index, { end: event.target.value })}
          />
          <button
            type="button"
            className="training-routine__remove"
            aria-label={t`Remove`}
            onClick={() => update(sessions.filter((_, i) => i !== index))}
          >
            ×
          </button>
        </div>
      ))}

      {sessions.length < MAX_SESSIONS && (
        <button
          type="button"
          className="training-routine__add"
          onClick={() => update([...sessions, { day: 1, kind: 'training', start: '18:00', end: '20:00' }])}
        >
          <Trans>+ Add training or match</Trans>
        </button>
      )}

      <p className="settings-hint">
        <Trans>
          On these days you get a notification 3 hours before and one 2 hours after, instead of the
          daily reminder. If you leave this empty, you only get the daily reminder.
        </Trans>
      </p>
    </div>
  )
}
