import { describe, expect, it } from 'vitest'
import { toFeedbackRow } from './feedback'

describe('feedback', () => {
  it('keeps only the known fields, with the day and nothing that identifies the sender', () => {
    expect(
      toFeedbackRow({ kind: 'idea', message: '  More words for the cycle ', screen: 'check-in', language: 'it', name: 'Giulia' }, '2026-10-05'),
    ).toEqual({ day: '2026-10-05', kind: 'idea', message: 'More words for the cycle', screen: 'check-in', language: 'it' })
  })

  it('refuses empty or unknown messages, and files unknown screens under "general"', () => {
    expect(toFeedbackRow({ kind: 'idea', message: '   ' }, '2026-10-05')).toBeNull()
    expect(toFeedbackRow({ kind: 'spam', message: 'x' }, '2026-10-05')).toBeNull()
    expect(toFeedbackRow({ kind: 'like', message: 'x'.repeat(1001) }, '2026-10-05')).toBeNull()
    expect(toFeedbackRow({ kind: 'like', message: 'ok', screen: 'admin' }, '2026-10-05')?.screen).toBe('general')
  })
})
