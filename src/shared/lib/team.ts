import { safeStorage } from './safeStorage'

/**
 * Teams with a pilot of their own. Their link (e.g. https://bab-analytics.vercel.app/verovolley)
 * tags the phone: the small script in index.html saves the team before the app starts and points
 * "Add to Home Screen" at the team's manifest, whose start address carries ?team=… — so the
 * installed app (which on iPhone has storage of its own) is tagged too. A tagged phone sends its
 * usage statistics and feedback to the team's own database (api/team-usage.ts, api/feedback.ts).
 */
export const TEAMS = ['verovolley'] as const
export type Team = (typeof TEAMS)[number]
export const TEAM_KEY = 'bab.team'

export const isTeam = (value: unknown): value is Team => (TEAMS as readonly unknown[]).includes(value)

export const currentTeam = (): Team | null => {
  const saved = safeStorage.getItem(TEAM_KEY)
  return isTeam(saved) ? saved : null
}

/** an API address with the team, if any: /api/feedback → /api/feedback?team=verovolley */
export const withTeam = (url: string, team: Team | null = currentTeam()): string =>
  team ? `${url}${url.includes('?') ? '&' : '?'}team=${team}` : url
