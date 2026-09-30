export const ROUTES = {
  checkIn: '/',
  words: '/words',
  checkInFlow: '/words/:wordId/check-in',
  calendar: '/calendar',
  settings: '/settings',
  world: '/world',
  feedback: '/feedback',
} as const

export const checkInFlowPath = (wordId: string, date?: string, entryId?: string): string => {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (entryId) params.set('entryId', entryId)
  const query = params.toString()
  return query ? `/words/${wordId}/check-in?${query}` : `/words/${wordId}/check-in`
}

export const wordsPath = (date?: string, entryId?: string): string => {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (entryId) params.set('entryId', entryId)
  const query = params.toString()
  return query ? `${ROUTES.words}?${query}` : ROUTES.words
}

export const calendarPath = (date?: string): string =>
  date ? `${ROUTES.calendar}?date=${date}` : ROUTES.calendar
