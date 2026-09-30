import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/render'
import { TrainingRoutineSetting } from './TrainingRoutineSetting'
import { getTrainingRoutine } from './trainingRoutine'

describe('TrainingRoutineSetting', () => {
  it('adds, edits and removes sessions, and reschedules the notifications each time', async () => {
    const onChange = vi.fn()
    render(<TrainingRoutineSetting onChange={onChange} />)
    expect(getTrainingRoutine()).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: '+ Add training or match' }))
    expect(getTrainingRoutine()).toEqual([{ day: 1, kind: 'training', start: '18:00', end: '20:00' }])

    await userEvent.selectOptions(screen.getByLabelText('Day'), '6')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'match')
    expect(getTrainingRoutine()).toEqual([{ day: 6, kind: 'match', start: '18:00', end: '20:00' }])

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(getTrainingRoutine()).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(4)
  })
})
