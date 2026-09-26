import { useEffect, useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useContent } from '@/i18n'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import type { CheckInEntry } from '@/entities/check-in/types'
import { ROUTES, calendarPath, wordsPath } from '@/routes/paths'
import { PageFrame } from '@/shared/layout'
import { TabBar } from '@/shared/ui'
import { pastOrTodayKey } from '@/shared/lib/dateKey'
import { CheckInFlow } from './CheckInFlow'

/** Full-screen route for the check-in wizard — its own PageFrame, its own URL,
 * so it gets a real screen and native back-button behavior for free. */
export const CheckInFlowPage = () => {
  const { wordId } = useParams<{ wordId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { wordCards } = useContent()
  const word = wordCards.find((card) => card.id === wordId)

  // a day in the future is treated as today: check-ins can't be added ahead of time
  const date = pastOrTodayKey(searchParams.get('date'))
  const entryId = searchParams.get('entryId') ?? undefined

  // The entry being edited, tagged with the id it was loaded for so a stale
  // result never shows up under a different entryId.
  const [loaded, setLoaded] = useState<{ id: string; entry: CheckInEntry | null } | null>(null)

  useEffect(() => {
    if (!entryId) return
    let cancelled = false
    checkInRepository.getById(entryId).then((found) => {
      if (!cancelled) setLoaded({ id: entryId, entry: found })
    })
    return () => {
      cancelled = true
    }
  }, [entryId])

  // undefined = still loading the entry being edited; null = not editing one
  const editing = !entryId ? null : loaded?.id === entryId ? loaded.entry : undefined

  if (!word) {
    return (
      <PageFrame>
        <p>
          <Trans>Unknown word.</Trans>
        </p>
        <button type="button" onClick={() => navigate(wordsPath(date))}>
          <Trans>Back to words</Trans>
        </button>
      </PageFrame>
    )
  }

  if (editing === undefined) {
    return (
      <PageFrame>
        <p>
          <Trans>Loading…</Trans>
        </p>
      </PageFrame>
    )
  }

  // editing an entry started right from the calendar, skipping the word
  // grid, so cancelling it should return there too; a fresh check-in
  // (with or without a target day) started from the word grid instead.
  const cancelTo = entryId ? calendarPath(date) : wordsPath(date)
  // a date param means this flow was reached from the calendar — land back
  // on that day instead of the "today" home screen once it's saved.
  const doneTo = date ? calendarPath(date) : ROUTES.checkIn

  return (
    <PageFrame>
      <CheckInFlow
        word={word}
        date={date}
        editing={editing ?? undefined}
        onCancel={() => navigate(cancelTo)}
        onDone={() => navigate(doneTo)}
      />
      <TabBar />
    </PageFrame>
  )
}
