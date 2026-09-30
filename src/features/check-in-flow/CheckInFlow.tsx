import { useLayoutEffect, useRef, useState } from 'react'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import type { WordCard } from '@/i18n'
import type { CheckInEntry } from '@/entities/check-in/types'
import { useHeadWord } from '@/entities/avatar/headWord'
import { todayKey } from '@/shared/lib/dateKey'
import { useCheckInDraft } from './useCheckInDraft'
import { BodyLocationStep, IntensityStep, NotesStep, SummaryStep } from './steps'
import { CheckInStepHeader } from './CheckInStepHeader'
import { IntensityScaleDialog } from './IntensityScaleDialog'
import { Button } from '@/shared/ui'
import { usesPainScale } from '@/entities/check-in/vasScale'
import './CheckInFlow.css'

type Step = 'location' | 'intensity' | 'notes' | 'confirm'

const STEP_TITLES: Record<Step, MessageDescriptor> = {
  location: msg`Body Map`,
  intensity: msg`Intensity`,
  notes: msg`Notes`,
  confirm: msg`Summary`,
}

const PREVIOUS_STEP: Record<Step, Step> = {
  intensity: 'intensity',
  location: 'intensity',
  notes: 'location',
  confirm: 'notes',
}

/** Debug-simple wizard: word -> body zone -> intensity -> save. Steps are plain
 * buttons on purpose; the visual pass (body-map silhouette, resize gesture) comes later. */
export const CheckInFlow = ({
  word,
  date,
  editing,
  onDone,
  onCancel,
}: {
  word: WordCard
  /** day to log this check-in against — omit to use today */
  date?: string
  /** existing entry being edited, instead of creating a new one */
  editing?: CheckInEntry
  onDone: () => void
  onCancel: () => void
}) => {
  const { t, i18n } = useLingui()
  const [step, setStep] = useState<Step>('intensity')
  const [intensityScaleOpen, setIntensityScaleOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const draft = useCheckInDraft(word, date, editing)
  const { saveHeadWord } = useHeadWord()

  const wordName = word.word
  // strong / light describe the whole body, not a spot: no body map for them
  const asksLocation = usesPainScale(word.id)
  const previousStep = (current: Step): Step =>
    current === 'notes' && !asksLocation ? 'intensity' : PREVIOUS_STEP[current]

  // the scrolling box is the same element for every step, so it would otherwise
  // carry the previous step's scroll position into the next one
  useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [step])

  const handleSave = async () => {
    const entry = await draft.commit()
    if (entry) {
      // a check-in for today puts its feeling on the character's head, whether
      // it's the day's first or another one added later; logging an earlier
      // day or fixing an old entry says nothing about the present
      if (!editing && (!date || date === todayKey())) saveHeadWord(word.id)
      onDone()
    }
  }

  const scrollToEnd = () => {
    const content = contentRef.current
    if (!content) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    content.scrollTo({ top: content.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <div className="check-in-flow" role="dialog" aria-label={t`Check in: ${wordName}`}>
      {/* the design's summary screen is the finished result, so it has no step header */}
      {step !== 'confirm' && (
          <CheckInStepHeader
            title={i18n._(STEP_TITLES[step])}
            onBack={step === 'intensity' ? onCancel : () => setStep(previousStep(step))}
          />
        )}
        <div ref={contentRef} className="check-in-flow-content">
          {step === 'intensity' && (
            <IntensityStep
              word={word}
              value={draft.intensity}
              onSelect={draft.setIntensity}
              triggers={draft.triggers}
              onTriggerToggle={draft.toggleTrigger}
              onOpenInfo={() => setIntensityScaleOpen(true)}
            />
          )}

          {step === 'location' && (
            <BodyLocationStep value={draft.bodyZones} onToggle={draft.toggleBodyZone} />
          )}

          {step === 'notes' && (
            <NotesStep
              energy={draft.energy}
              onEnergyChange={draft.setEnergy}
              note={draft.note}
              onNoteChange={draft.setNote}
              date={date}
            />
          )}

          {step === 'confirm' && draft.bodyZones.length > 0 && (
            <>
              <SummaryStep word={word} onScrollDown={scrollToEnd} />
              {/* Deliberately at the end of the content rather than pinned: this is
                  the result screen, so the save button is reached by reading (or
                  scrolling) through it to the bottom. */}
              <Button className="check-in-flow-save" disabled={draft.saving} onClick={handleSave}>
                {draft.saving ? t`Saving…` : editing ? t`Update check-in` : t`Save check-in`}
              </Button>
            </>
          )}
        </div>

        {/* Kept outside the scrollable, container-query-sized content box on
            purpose — a step's own content can grow past one screen (long notes,
            a full help list), and a primary action button that scrolls along
            with it is easy to miss or mis-tap on a real phone. Pinning it here
            keeps it visible and reliably tappable regardless of step length. The
            final Summary step is the exception: its save button sits at the end
            of the content instead. */}
        {step !== 'confirm' && (
        <div className="check-in-flow-footer">
          {step === 'intensity' && (
            <Button onClick={() => setStep(asksLocation ? 'location' : 'notes')}>
              <Trans>Next</Trans>
            </Button>
          )}
          {step === 'location' && (
            <Button disabled={draft.bodyZones.length === 0} onClick={() => setStep('notes')}>
              <Trans>Next</Trans>
            </Button>
          )}
          {step === 'notes' && (
            <Button onClick={() => setStep('confirm')}>
              <Trans>Next</Trans>
            </Button>
          )}
        </div>
      )}

      {intensityScaleOpen && (
        <IntensityScaleDialog
          level={draft.intensity}
          onSelect={draft.setIntensity}
          onClose={() => setIntensityScaleOpen(false)}
        />
      )}
    </div>
  )
}
