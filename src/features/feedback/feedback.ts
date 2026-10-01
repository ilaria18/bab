/**
 * Anonymous feedback from the athletes (the "Feedback" tab): what they like, ideas, problems.
 * Sent to api/feedback.ts with no name, no participant code, no device id: only the kind,
 * the text and which part of the app it's about. The server keeps only the week it arrived.
 */

export const FEEDBACK_API = '/api/feedback'
export const MAX_MESSAGE = 1000

export type FeedbackKind = 'like' | 'idea' | 'problem'
export type FeedbackScreen = 'general' | 'check-in' | 'journal' | 'patterns' | 'world' | 'settings' | 'reminders'

export type Feedback = { kind: FeedbackKind; message: string; screen: FeedbackScreen }

export const sendFeedback = async (feedback: Feedback): Promise<void> => {
  const response = await fetch(FEEDBACK_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...feedback, message: feedback.message.trim() }),
    credentials: 'omit',
  })
  if (!response.ok) throw new Error(`feedback: ${response.status}`)
}
