import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@/test/render'
import { wordCardsFor } from '@/i18n'
import { IntensityStep } from './IntensityStep'

const word = (id: string) => wordCardsFor('en').find((card) => card.id === id)!

const renderStep = (id: string) =>
  render(
    <IntensityStep word={word(id)} value={5} onSelect={vi.fn()} triggers={[]} onTriggerToggle={vi.fn()} onOpenInfo={vi.fn()} />,
  )

describe('IntensityStep', () => {
  it('asks when a symptom is noticed', () => {
    renderStep('sore')
    expect(screen.getByText('When do you notice it?')).toBeTruthy()
  })

  it('does not ask it for the positive words strong and light', () => {
    renderStep('strong')
    expect(screen.queryByText('When do you notice it?')).toBeNull()
  })
})
