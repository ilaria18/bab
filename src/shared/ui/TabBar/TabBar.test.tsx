import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@/test/render'
import { TabBar } from './TabBar'

describe('TabBar', () => {
  it('shows every tab under its translated label', () => {
    render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    )

    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(nav.textContent).toBe('HomeJournalWorldFeedbackSettings')
  })
})
