import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/render'
import { UsageConsentPrompt } from './UsageConsentPrompt'
import { getUsageConsent, setUsageConsent } from './usageStats'

describe('UsageConsentPrompt', () => {
  it('asks once; "Yes, share" turns the statistics on', async () => {
    const { unmount } = render(<UsageConsentPrompt available />)
    expect(getUsageConsent()).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Yes, share' }))
    expect(getUsageConsent()).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()

    unmount()
    render(<UsageConsentPrompt available />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('"No, thanks" keeps them off and the question does not come back', async () => {
    const { unmount } = render(<UsageConsentPrompt available />)
    await userEvent.click(screen.getByRole('button', { name: 'No, thanks' }))
    expect(getUsageConsent()).toBe(false)

    unmount()
    render(<UsageConsentPrompt available />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is not asked again after a choice made in Settings, nor where nothing is measured', () => {
    render(<UsageConsentPrompt available={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    setUsageConsent(false)
    render(<UsageConsentPrompt available />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
