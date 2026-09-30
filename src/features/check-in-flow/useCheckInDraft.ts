import { useState } from 'react'
import type { WordCard } from '@/i18n'
import {
  DEFAULT_CHECK_IN_INTENSITY,
  DEFAULT_ENERGY,
  type BodyZone,
  type CheckInEntry,
  type CheckInIntensity,
  type Energy,
  type Trigger,
} from '@/entities/check-in/types'
import { checkInRepository } from '@/entities/check-in/checkInRepository'
import { recordCheckIn } from '@/features/usage-stats/usageStats'
import { usesPainScale } from '@/entities/check-in/vasScale'

/** Holds the in-progress answers for one check-in flow and commits them
 * to the repository once both are picked. Nothing here is saved until commit().
 * `date` lets the flow log against a past day instead of today. Pass `editing`
 * to seed the draft from an existing entry and patch it in place on commit,
 * instead of creating a new one. */
export const useCheckInDraft = (word: WordCard, date?: string, editing?: CheckInEntry) => {
  const [bodyZones, setBodyZones] = useState<BodyZone[]>(editing?.bodyZones ?? [])
  const [intensity, setIntensity] = useState<CheckInIntensity>(
    editing?.intensity ?? DEFAULT_CHECK_IN_INTENSITY,
  )
  const [energy, setEnergy] = useState<Energy | null>(editing?.energy ?? DEFAULT_ENERGY)
  const [triggers, setTriggers] = useState<Trigger[]>(editing?.triggers ?? [])
  const [note, setNote] = useState(editing?.note ?? '')
  const [saving, setSaving] = useState(false)

  const toggleBodyZone = (zone: BodyZone) => {
    setBodyZones((zones) =>
      zones.includes(zone) ? zones.filter((existing) => existing !== zone) : [...zones, zone],
    )
  }

  const toggleTrigger = (trigger: Trigger) => {
    setTriggers((current) =>
      current.includes(trigger) ? current.filter((existing) => existing !== trigger) : [...current, trigger],
    )
  }

  // strong / light skip the body map: they are about the whole body
  const zones: BodyZone[] = usesPainScale(word.id) ? bodyZones : ['whole']

  const commit = async (): Promise<CheckInEntry | null> => {
    if (zones.length === 0) return null
    setSaving(true)
    try {
      const payload = {
        wordId: word.id,
        bodyZones: zones,
        intensity,
        energy: energy ?? undefined,
        // strong / light don't ask when it's noticed: drop any answer left from another word
        triggers: usesPainScale(word.id) && triggers.length > 0 ? triggers : undefined,
        note: note.trim() || undefined,
      }
      if (editing) return await checkInRepository.update(editing.id, payload)
      const saved = await checkInRepository.save(payload, date)
      recordCheckIn()
      return saved
    } finally {
      setSaving(false)
    }
  }

  return {
    bodyZones: zones,
    toggleBodyZone,
    intensity,
    setIntensity,
    energy,
    setEnergy,
    triggers,
    toggleTrigger,
    note,
    setNote,
    saving,
    commit,
  }
}
