import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/render'
import { TrainingRoutineSetting } from './TrainingRoutineSetting'
import { getTrainingRoutine } from './trainingRoutine'

describe('TrainingRoutineSetting', () => {
  it('saves a session only with "Save", then lists it; edit and remove work on the saved line', async () => {
    const onChange = vi.fn()
    render(<TrainingRoutineSetting onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: '+ Add training or match' }))
    await userEvent.selectOptions(screen.getByLabelText('Day'), '6')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'match')
    expect(getTrainingRoutine()).toEqual([]) // nothing stored while the form is open
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(getTrainingRoutine()).toEqual([{ day: 6, kind: 'match', start: '18:00', end: '20:00' }])
    expect(screen.getByText('18:00–20:00')).toBeTruthy()
    expect(screen.queryByLabelText('Day')).toBeNull() // the form closes

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'training')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(getTrainingRoutine()[0].kind).toBe('match') // cancelled: unchanged

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(getTrainingRoutine()).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
