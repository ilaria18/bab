import { useState } from 'react'
import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@/shared/ui'
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
const NEW_SESSION: Session = { day: 1, kind: 'training', start: '18:00', end: '20:00' }

/** which session is open in the form: an existing one (by index) or a new one (null) */
type Editing = { index: number | null; draft: Session }

/**
 * The weekly routine of training sessions and matches, entered by the athlete (optional).
 * Saved sessions are listed as plain lines; "+ Add" opens a form that is saved only with "Save",
 * so it's always clear what is stored. On those days she gets a notification 3 hours before and
 * one 2 hours after each session, instead of the daily reminder. `onChange` reschedules them.
 */
export const TrainingRoutineSetting = ({ onChange }: { onChange: () => void }) => {
  const { t, i18n } = useLingui()
  const [sessions, setSessions] = useState<Session[]>(getTrainingRoutine)
  const [editing, setEditing] = useState<Editing | null>(null)

  const store = (next: Session[]) => {
    saveTrainingRoutine(next)
    setSessions(next)
    onChange()
  }
  const save = () => {
    if (!editing) return
    store(
      editing.index === null
        ? [...sessions, editing.draft]
        : sessions.map((session, i) => (i === editing.index ? editing.draft : session)),
    )
    setEditing(null)
  }
  const change = (patch: Partial<Session>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } })

  const dayName = (day: IsoWeekday) =>
    i18n.date(new Date(A_MONDAY.getTime() + (day - 1) * 86_400_000), { weekday: 'long' })
  const kindName = (kind: SessionKind) => (kind === 'match' ? t`Match` : t`Training`)

  return (
    <div className="training-routine">
      <span className="settings-label">
        <Trans>Training and matches</Trans>
      </span>

      {sessions.length > 0 && (
        <ul className="training-routine__list">
          {sessions.map((session, index) =>
            editing?.index === index ? null : (
              <li key={index} className="training-routine__saved">
                <span className="training-routine__summary">
                  <b>
                    {dayName(session.day)} · {kindName(session.kind)}
                  </b>
                  <span>
                    {session.start}–{session.end}
                  </span>
                </span>
                <button
                  type="button"
                  className="settings-link-button"
                  disabled={editing !== null}
                  onClick={() => setEditing({ index, draft: session })}
                >
                  <Trans>Edit</Trans>
                </button>
                <button
                  type="button"
                  className="training-routine__remove"
                  aria-label={t`Remove`}
                  disabled={editing !== null}
                  onClick={() => store(sessions.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {editing ? (
        <div className="training-routine__form">
          <div className="training-routine__session">
            <select
              className="settings-select training-routine__day"
              aria-label={t`Day`}
              value={editing.draft.day}
              onChange={(event) => change({ day: Number(event.target.value) as IsoWeekday })}
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
              value={editing.draft.kind}
              onChange={(event) => change({ kind: event.target.value as SessionKind })}
            >
              <option value="training">{t`Training`}</option>
              <option value="match">{t`Match`}</option>
            </select>
            <label className="training-routine__time training-routine__start">
              <span>
                <Trans>Start</Trans>
              </span>
              <input
                className="settings-name-input"
                type="time"
                value={editing.draft.start}
                onChange={(event) => event.target.value && change({ start: event.target.value })}
              />
            </label>
            <label className="training-routine__time training-routine__end">
              <span>
                <Trans>End</Trans>
              </span>
              <input
                className="settings-name-input"
                type="time"
                value={editing.draft.end}
                onChange={(event) => event.target.value && change({ end: event.target.value })}
              />
            </label>
          </div>
          <Button onClick={save}>
            <Trans>Save</Trans>
          </Button>
          <button type="button" className="settings-link-button" onClick={() => setEditing(null)}>
            <Trans>Cancel</Trans>
          </button>
        </div>
      ) : (
        sessions.length < MAX_SESSIONS && (
          <button
            type="button"
            className="training-routine__add"
            onClick={() => setEditing({ index: null, draft: NEW_SESSION })}
          >
            <Trans>+ Add training or match</Trans>
          </button>
        )
      )}

      <p className="settings-hint">
        <Trans>A notification 3 hours before and 2 hours after, instead of the daily one.</Trans>
      </p>
    </div>
  )
}
