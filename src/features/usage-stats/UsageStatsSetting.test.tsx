import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@/test/render'
import { UsageStatsSetting } from './UsageStatsSetting'
import { getUsageConsent } from './usageStats'

describe('UsageStatsSetting', () => {
  it('is off until the athlete chooses to share, and can be switched off again', async () => {
    render(<UsageStatsSetting enabled />)
    expect(getUsageConsent()).toBe(false)
    expect(screen.getByRole('button', { name: "Don't share" }).getAttribute('aria-pressed')).toBe('true')

    await userEvent.click(screen.getByRole('button', { name: 'Share' }))
    expect(getUsageConsent()).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: "Don't share" }))
    expect(getUsageConsent()).toBe(false)
  })

  it('is not shown when the build has nowhere to send statistics', () => {
    render(<UsageStatsSetting enabled={false} />)
    expect(screen.queryByText('Anonymous statistics')).toBeNull()
  })
})
