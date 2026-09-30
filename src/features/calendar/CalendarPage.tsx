import { createContext, useContext, useMemo, useState } from 'react'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import { addMonths, isAfter, isSameMonth, startOfDay } from 'date-fns'
import { Trans, useLingui } from '@lingui/react/macro'
import 'react-day-picker/style.css'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '@/shared/layout'
import { Greeting, TabBar, ToggleSwitch } from '@/shared/ui'
import { toDateKey } from '@/shared/lib/dateKey'
import { WordShape } from '@/entities/word'
import { useContent, type WordCard } from '@/i18n'
import { wordsPath } from '@/routes/paths'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import type { CheckInEntry } from '@/entities/check-in/types'
import type { DailyLog } from '@/entities/daily-log/types'
import { DayLogDialog } from './DayLogDialog'
import { PatternsView } from '@/features/patterns/PatternsView'
import { useCalendarMonthData } from './useCalendarMonthData'
import './CalendarPage.css'

const MonthChevron = ({ direction }: { direction: 'left' | 'right' }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d={direction === 'left' ? 'M15 18 9 12l6-6' : 'M9 6l6 6-6 6'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const parseDateKey = (key: string | null): Date | undefined => {
  if (!key) return undefined
  const parsed = new Date(`${key}T00:00:00`)
  // future days can't be opened: nothing can be logged there yet
  return Number.isNaN(parsed.getTime()) || isAfter(parsed, startOfDay(new Date())) ? undefined : parsed
}

// A day's marks stay on a single row, so the period drop and the "+N" counter
// each take one of these slots instead of wrapping to a second line.
const MARK_SLOTS = 3

type DayMarks = {
  entriesByDate: Record<string, CheckInEntry[]>
  dailyLogsByDate: Record<string, DailyLog>
  wordCardsById: Map<string, WordCard>
}

// The day button has to be a stable component: if it were rebuilt whenever a month's
// data loads, React would throw away and re-mount every day cell. It reads the
// entries/logs from context instead.
const DayMarksContext = createContext<DayMarks>({
  entriesByDate: {},
  dailyLogsByDate: {},
  wordCardsById: new Map(),
})

const CalendarDayButton = ({ day, modifiers: _modifiers, className, ...props }: DayButtonProps) => {
  const { t } = useLingui()
  const { entriesByDate, dailyLogsByDate, wordCardsById } = useContext(DayMarksContext)
  const dateKey = toDateKey(day.date)
  const dayEntries = entriesByDate[dateKey]
  // one icon per distinct feeling logged that day, most recent first —
  // walk entries newest-to-oldest so a repeated word keeps its latest slot
  const dayWords: WordCard[] = []
  const seenWordIds = new Set<string>()
  for (let i = (dayEntries?.length ?? 0) - 1; i >= 0; i--) {
    const entry = dayEntries![i]
    if (seenWordIds.has(entry.wordId)) continue
    seenWordIds.add(entry.wordId)
    const card = wordCardsById.get(entry.wordId)
    if (card) dayWords.push(card)
  }
  const hadPeriod = dailyLogsByDate[dateKey]?.hadPeriod
  const slots = hadPeriod ? MARK_SLOTS - 1 : MARK_SLOTS
  // when the words don't all fit, the last slot turns into the "+N" counter
  const visibleWords = dayWords.slice(0, dayWords.length > slots ? slots - 1 : slots)
  const extraMoodCount = dayWords.length - visibleWords.length

  return (
    <button {...props} className={`${className ?? ''} calendar-day-button`}>
      <span className="calendar-day-number">{day.date.getDate()}</span>
      <span className="calendar-day-marks">
        {visibleWords.map((word) => (
          <span key={word.id} className="calendar-day-mood" title={word.word}>
            <WordShape card={word} expressive fit />
          </span>
        ))}
        {extraMoodCount > 0 && (
          <span className="calendar-day-mood-more" title={t`+${extraMoodCount} more`}>
            +{extraMoodCount}
          </span>
        )}
        {hadPeriod && (
          <span className="calendar-day-period" aria-label={t`On period`}>
            🩸
          </span>
        )}
      </span>
    </button>
  )
}

// hoisted so DayPicker always receives the same object and doesn't rebuild its day cells
const DAY_PICKER_COMPONENTS = { DayButton: CalendarDayButton }

export const CalendarPage = () => {
  const { t, i18n } = useLingui()
  const { wordCards, dateLocale } = useContent()
  const [searchParams] = useSearchParams()
  const initialDate = useMemo(() => parseDateKey(searchParams.get('date')), [searchParams])

  const [view, setView] = useState<'calendar' | 'patterns'>(searchParams.get('view') === 'patterns' ? 'patterns' : 'calendar')
  const [month, setMonth] = useState(initialDate ?? new Date())
  const today = new Date()
  // check-ins can only be added for today or past days: later days can't be picked,
  // and the calendar doesn't go past the current month
  const isCurrentMonth = isSameMonth(month, today) || isAfter(month, today)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate)
  const { entriesByDate, dailyLogsByDate, refetch } = useCalendarMonthData(month)

  const selectedKey = selectedDate ? toDateKey(selectedDate) : null
  const selectedEntries = selectedKey ? (entriesByDate[selectedKey] ?? []) : []
  const selectedLog = selectedKey ? dailyLogsByDate[selectedKey] : undefined

  const handleDelete = async (id: string) => {
    if (!window.confirm(t`Delete this check-in?`)) return
    await checkInRepository.remove(id)
    refetch()
  }

  const dayMarks = useMemo(
    () => ({
      entriesByDate,
      dailyLogsByDate,
      wordCardsById: new Map(wordCards.map((card) => [card.id, card])),
    }),
    [entriesByDate, dailyLogsByDate, wordCards],
  )

  return (
    <PageFrame>
      <Greeting />
      <div className="calendar-wrapper">
        <div className="calendar-header">
          <h1 className="calendar-title">
            <Trans>How is your journey?</Trans>
          </h1>
        </div>

        <ToggleSwitch
          options={[
            { value: 'calendar', label: t`Calendar` },
            { value: 'patterns', label: t`My patterns` },
          ]}
          value={view}
          onChange={setView}
        />

        {view === 'patterns' && <PatternsView />}

        <div className="calendar-month" hidden={view !== 'calendar'}>
          <div className="calendar-month-nav">
            <button
              type="button"
              className="calendar-month-nav-button"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              aria-label={t`Previous month`}
            >
              <MonthChevron direction="left" />
            </button>
            <h2 className="calendar-month-title" aria-live="polite">
              {i18n.date(month, { month: 'long', year: 'numeric' })}
            </h2>
            <button
              type="button"
              className="calendar-month-nav-button"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              aria-label={t`Next month`}
              disabled={isCurrentMonth}
            >
              <MonthChevron direction="right" />
            </button>
          </div>

          <DayMarksContext.Provider value={dayMarks}>
            <DayPicker
              mode="single"
              month={month}
              onMonthChange={setMonth}
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={{ after: today }}
              weekStartsOn={1}
              locale={dateLocale}
              hideNavigation
              components={DAY_PICKER_COMPONENTS}
              className="calendar-picker"
            />
          </DayMarksContext.Provider>
        </div>
      </div>
      <div className="calendar-cta">
        <Link className="calendar-add-button" to={wordsPath()}>
          <Trans>Add new sensation</Trans>
        </Link>
      </div>

      {selectedDate && view === 'calendar' && (
        <DayLogDialog
          date={selectedDate}
          entries={selectedEntries}
          dailyLog={selectedLog}
          onClose={() => setSelectedDate(undefined)}
          onDelete={handleDelete}
        />
      )}
      <TabBar />
    </PageFrame>
  )
}
