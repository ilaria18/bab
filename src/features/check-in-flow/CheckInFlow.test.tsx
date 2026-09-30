import { render, screen, waitFor } from '@/test/render'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { wordCardsFor } from '@/i18n'
import { todayKey } from '@/shared/lib/dateKey'
import { CheckInFlow } from './CheckInFlow'

const word = wordCardsFor('en').find((card) => card.id === 'sharp')!
const HEAD_KEY = 'world-head-word'

/** Steps through to the summary and presses save. */
const saveCheckIn = async (props: { date?: string } = {}) => {
  const user = userEvent.setup()
  const onDone = vi.fn()
  render(<CheckInFlow word={word} onDone={onDone} onCancel={() => {}} {...props} />)
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getAllByRole('button', { name: /head|neck|shoulder|chest/i })[0])
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('button', { name: 'Save check-in' }))
  await waitFor(() => expect(onDone).toHaveBeenCalled())
}

describe('CheckInFlow', () => {
  it('shows the character with the chosen feeling as its head on the summary', async () => {
    const user = userEvent.setup()
    render(<CheckInFlow word={word} onDone={() => {}} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getAllByRole('button', { name: /head|neck|shoulder|chest/i })[0])
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('img', { name: 'Your character, feeling sharp' })).toBeTruthy()
  })

  it('puts the feeling on the character’s head for good once saved', async () => {
    await saveCheckIn()
    expect(window.localStorage.getItem(HEAD_KEY)).toBe('sharp')
  })

  it('leaves the head alone when logging an earlier day', async () => {
    await saveCheckIn({ date: '2020-01-01' })
    expect(window.localStorage.getItem(HEAD_KEY)).toBeNull()
  })

  it('still updates the head when a later same-day check-in is logged with today\'s date', async () => {
    // the calendar's "log another sensation" link on today's day cell passes
    // today's own date key, same as one picked from the past
    await saveCheckIn({ date: todayKey() })
    expect(window.localStorage.getItem(HEAD_KEY)).toBe('sharp')
  })

  it('skips the body map for strong and light, and saves them for the whole body', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    const strong = wordCardsFor('en').find((card) => card.id === 'strong')!
    render(<CheckInFlow word={strong} onDone={onDone} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Anything else you want to share?')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Save check-in' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const [saved] = JSON.parse(window.localStorage.getItem('check-ins')!)
    expect(saved).toMatchObject({ wordId: 'strong', bodyZones: ['whole'] })
    expect(saved.triggers).toBeUndefined()
  })
})
