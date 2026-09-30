import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useLingui } from '@lingui/react/macro'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import { dailyLogRepository } from '@/entities/daily-log/dailyLogRepository'
import type { CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { WordShape } from '@/entities/word'
import { useContent } from '@/i18n'
import { ROUTES } from '@/routes/paths'
import { todayKey } from '@/shared/lib/dateKey'
import { getTrainingRoutine } from '@/features/reminder/trainingRoutine'
import { FemaleBodyFront } from '@/features/check-in-flow/steps/BodyLocationStep/FemaleBodyFront'
import { FemaleBodyBack } from '@/features/check-in-flow/steps/BodyLocationStep/FemaleBodyBack'
import { cycleCard, energyCard, trainingCard, wordsCard, zonesCard, type Progress, type Trend } from './patterns'
import './PatternsView.css'

/** how two averages compare, with a margin so tiny differences read as "about the same" */
const compare = (a: number | null, b: number | null): 'higher' | 'lower' | 'same' | null =>
  a === null || b === null ? null : a - b > 0.5 ? 'higher' : b - a > 0.5 ? 'lower' : 'same'

const Card = ({ title, children }: { title: ReactNode; children: ReactNode }) => (
  <section className="pattern-card">
    <h3 className="pattern-card__title">{title}</h3>
    {children}
  </section>
)

/** until a card has enough check-ins: what it needs, and how far she is */
const Waiting = ({ progress, children }: { progress: Progress; children: ReactNode }) => (
  <div className="pattern-waiting">
    <p className="pattern-card__text">{children}</p>
    <div className="pattern-waiting__track" aria-hidden="true">
      <span className="pattern-waiting__fill" style={{ width: `${(100 * progress.have) / progress.need}%` }} />
    </div>
    <p className="pattern-waiting__count">
      {progress.have} / {progress.need}
    </p>
  </div>
)

type Series = { label: string; className: 'a' | 'b' }
/** two bars per measure, each measure on its own scale, every value written next to its bar */
const Compare = ({
  series,
  rows,
}: {
  series: [Series, Series]
  rows: { label: string; max: number; values: [number | null, number | null] }[]
}) => {
  const { i18n } = useLingui()
  return (
    <div className="pattern-compare">
      <ul className="pattern-legend">
        {series.map((s) => (
          <li key={s.label}>
            <i className={`pattern-swatch pattern-swatch--${s.className}`} />
            {s.label}
          </li>
        ))}
      </ul>
      {rows.map((row) => (
        <div key={row.label} className="pattern-compare__group">
          <p className="pattern-compare__label">{row.label}</p>
          {series.map((s, i) => {
            const value = row.values[i]
            return (
              <div key={s.label} className="pattern-bar">
                <span
                  className={`pattern-bar__fill pattern-bar__fill--${s.className}`}
                  style={{ width: value === null ? 0 : `${Math.max((100 * value) / row.max, 2)}%` }}
                />
                <span className="pattern-bar__value">
                  {value === null ? '—' : i18n.number(value, { maximumFractionDigits: 1 })}
                  <span className="visually-hidden"> ({s.label})</span>
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

const TrendLabel = ({ trend }: { trend: Trend }) => {
  if (trend === 'new') return <Trans>new this month</Trans>
  if (trend === 'up') return <Trans>more than last month</Trans>
  if (trend === 'down') return <Trans>less than last month</Trans>
  return null
}

/** "My patterns": what her own check-ins say over time, computed on this phone only. */
export const PatternsView = () => {
  const { t } = useLingui()
  const { wordCards, bodyZoneShortLabel } = useContent()
  const [data, setData] = useState<{ entries: CheckInEntry[]; logs: DailyLog[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([checkInRepository.getAll(), dailyLogRepository.getRange('0000-01-01', '9999-12-31')]).then(
      ([entries, logs]) => {
        if (!cancelled) setData({ entries, logs })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const cards = useMemo(() => {
    if (!data) return null
    const today = todayKey()
    return {
      cycle: cycleCard(data.entries, data.logs),
      words: wordsCard(data.entries, today),
      zones: zonesCard(data.entries, today),
      training: trainingCard(data.entries, getTrainingRoutine()),
      energy: energyCard(data.entries, today),
    }
  }, [data])

  if (!cards) return null
  const wordById = new Map(wordCards.map((card) => [card.id, card]))
  const wordName = (id: string | null) => (id ? (wordById.get(id)?.word ?? id) : '')
  const intensityLabel = t`Intensity (0–10)`
  const energyLabel = t`Energy (1–7)`

  const { cycle, words, zones, training, energy } = cards
  const cycleIntensity = compare(cycle.period.intensity, cycle.other.intensity)
  const cycleEnergy = compare(cycle.period.energy, cycle.other.energy)
  const trainingIntensity = compare(training.after.intensity, training.before.intensity)
  const energyTrend = compare(energy.recentEnergy, energy.earlierEnergy)
  const topPeriodWord = wordName(cycle.topPeriodWord)
  const topAfterWord = wordName(training.topAfterWord)
  const positiveCount = energy.positiveCount
  const comingBack = zones.keepsComingBack.map(bodyZoneShortLabel).join(', ')

  return (
    <div className="patterns">
      <p className="patterns__intro">
        <Trans>What your check-ins say over time. Only you can see this: it's calculated on your phone.</Trans>
      </p>

      <Card title={<Trans>My cycle and my body</Trans>}>
        {cycle.ready ? (
          <>
            <p className="pattern-card__text">
              {cycleIntensity === 'higher' && <Trans>On period days your sensations are stronger on average.</Trans>}
              {cycleIntensity === 'lower' && <Trans>On period days your sensations are milder on average.</Trans>}
              {cycleIntensity === 'same' && <Trans>Your sensations are about the same on period days and on the other days.</Trans>}{' '}
              {cycleEnergy === 'lower' && <Trans>Your energy is lower.</Trans>}
              {cycleEnergy === 'higher' && <Trans>Your energy is higher.</Trans>}
              {cycleEnergy === 'same' && <Trans>Your energy is about the same.</Trans>}
            </p>
            <Compare
              series={[
                { label: t`On period`, className: 'b' },
                { label: t`Other days`, className: 'a' },
              ]}
              rows={[
                { label: intensityLabel, max: 10, values: [cycle.period.intensity, cycle.other.intensity] },
                { label: energyLabel, max: 7, values: [cycle.period.energy, cycle.other.energy] },
              ]}
            />
            {topPeriodWord && (
              <p className="pattern-card__text">
                <Trans>The word you use most on period days: {topPeriodWord}.</Trans>
              </p>
            )}
            <p className="pattern-card__note">
              <Trans>It's your body's rhythm, not a weakness: knowing it helps you plan training and recovery.</Trans>
            </p>
          </>
        ) : (
          <Waiting progress={cycle}>
            <Trans>
              To compare, you need at least 3 check-ins on period days and 3 on other days. Answer “On period
              today?” when you check in.
            </Trans>
          </Waiting>
        )}
      </Card>

      <Card title={<Trans>My words</Trans>}>
        {words.ready ? (
          <>
            <p className="pattern-card__text">
              <Trans>Your most frequent sensations in the last 30 days.</Trans>
            </p>
            <ol className="pattern-list">
              {words.top.map((item) => {
                const card = wordById.get(item.wordId)
                return (
                  <li key={item.wordId} className="pattern-list__item">
                    <span className="pattern-list__shape">{card && <WordShape card={card} expressive fit />}</span>
                    <span className="pattern-list__name">
                      {card?.word ?? item.wordId}
                      <small>
                        <TrendLabel trend={item.trend} />
                      </small>
                    </span>
                    <span className="pattern-list__count">{item.count}</span>
                  </li>
                )
              })}
            </ol>
          </>
        ) : (
          <Waiting progress={words}>
            <Trans>After 5 check-ins you'll see your most frequent words here.</Trans>
          </Waiting>
        )}
      </Card>

      <Card title={<Trans>The areas that speak most</Trans>}>
        {zones.ready ? (
          <>
            <div className="pattern-bodies" inert aria-hidden="true">
              <FemaleBodyFront value={zones.top.map((z) => z.zone)} onToggle={() => {}} />
              <FemaleBodyBack value={zones.top.map((z) => z.zone)} onToggle={() => {}} />
            </div>
            <ol className="pattern-list">
              {zones.top.map((item) => (
                <li key={item.zone} className="pattern-list__item">
                  <span className="pattern-list__name">{bodyZoneShortLabel(item.zone)}</span>
                  <span className="pattern-list__count">{item.count}</span>
                </li>
              ))}
            </ol>
            {comingBack && (
              <p className="pattern-card__alert">
                <Trans>
                  {comingBack}: an intense sensation came back on several days this week. Have you talked about it with
                  your coach or physio?
                </Trans>
              </p>
            )}
          </>
        ) : (
          <Waiting progress={zones}>
            <Trans>After 5 check-ins you'll see the areas you mark most here.</Trans>
          </Waiting>
        )}
      </Card>

      <Card title={<Trans>Before and after training</Trans>}>
        {!training.hasRoutine ? (
          <p className="pattern-card__text">
            <Trans>
              Add your training days in <Link to={ROUTES.settings}>Settings</Link> (Daily reminder → Training and
              matches) to see how you arrive at your sessions and how you leave them.
            </Trans>
          </p>
        ) : training.ready ? (
          <>
            <p className="pattern-card__text">
              {trainingIntensity === 'higher' && <Trans>After training your sensations are stronger than before.</Trans>}
              {trainingIntensity === 'lower' && <Trans>After training your sensations are milder than before.</Trans>}
              {trainingIntensity === 'same' && <Trans>Your sensations are about the same before and after training.</Trans>}
            </p>
            <Compare
              series={[
                { label: t`Before`, className: 'a' },
                { label: t`After`, className: 'b' },
              ]}
              rows={[
                { label: intensityLabel, max: 10, values: [training.before.intensity, training.after.intensity] },
                { label: energyLabel, max: 7, values: [training.before.energy, training.after.energy] },
              ]}
            />
            {topAfterWord && (
              <p className="pattern-card__text">
                <Trans>The word you use most after training: {topAfterWord}.</Trans>
              </p>
            )}
          </>
        ) : (
          <Waiting progress={training}>
            <Trans>Do a check-in before and after 2 training sessions to see the difference.</Trans>
          </Waiting>
        )}
      </Card>

      <Card title={<Trans>Energy and good days</Trans>}>
        {energy.ready ? (
          <>
            <p className="pattern-card__text">
              {energyTrend === 'higher' && <Trans>Your energy in the last 2 weeks is higher than in the 2 before.</Trans>}
              {energyTrend === 'lower' && <Trans>Your energy in the last 2 weeks is lower than in the 2 before.</Trans>}
              {energyTrend === 'same' && <Trans>Your energy in the last 2 weeks is about the same as in the 2 before.</Trans>}
              {energyTrend === null && <Trans>Your average energy in the last 2 weeks.</Trans>}
            </p>
            <Compare
              series={[
                { label: t`Last 2 weeks`, className: 'a' },
                { label: t`The 2 before`, className: 'b' },
              ]}
              rows={[{ label: energyLabel, max: 7, values: [energy.recentEnergy, energy.earlierEnergy] }]}
            />
          </>
        ) : (
          <Waiting progress={energy}>
            <Trans>After 3 check-ins with your energy level you'll see how it's changing.</Trans>
          </Waiting>
        )}
        <p className="pattern-card__text">
          {positiveCount > 0 ? (
            <Trans>You felt strong or light {positiveCount} times in the last 30 days.</Trans>
          ) : (
            <Trans>Good sensations count too: when you feel strong or light, note it!</Trans>
          )}
        </p>
      </Card>
    </div>
  )
}
