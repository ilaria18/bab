/**
 * First analyses of the check-ins athletes sent (research_checkins), for the dashboard's
 * "Check-ins" tab. Only aggregates leave this function: no notes, no row, no participant code.
 * A word, body area or group is named only when at least MIN_ATHLETES different athletes are in
 * it; the rest is folded into "Other" (or hidden), so no single athlete's answers can be read off.
 * (Files in api/ starting with "_" are not deployed as endpoints.)
 */

export const MIN_ATHLETES = 3
const TOP = 12

export type ResearchCheckinRow = {
  participant: string
  record: 'check-in' | 'day'
  date: string
  word_id: string | null
  word: string | null
  category: string | null
  intensity: number | null
  energy: number | null
  triggers: string[] | null
  body_zones: string[] | null
  on_period: boolean | null
  took_painkiller: boolean | null
}

/** kneeLeft → knee, kneeLeftBack → knee (back), head → head */
export const zoneRegion = (zone: string): string => {
  const back = zone.endsWith('Back') && !/^(upper|mid|lower)Back/.test(zone)
  const base = (back ? zone.slice(0, -4) : zone).replace(/(Left|Right)$/, '')
  const name = base.replace(/([A-Z])/g, ' $1').toLowerCase()
  return back ? `${name} (back)` : name
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null)
const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : round1((s[m - 1] + s[m]) / 2)
}

type Item = { label: string; count: number; athletes: number; meanIntensity: number | null; extra?: string }

/** counts per key, named only with ≥ MIN_ATHLETES athletes; the rest folded into "Other" */
const ranked = (checkIns: ResearchCheckinRow[], keysOf: (row: ResearchCheckinRow) => string[], extraOf?: (key: string) => string) => {
  const groups = new Map<string, { rows: ResearchCheckinRow[]; athletes: Set<string> }>()
  for (const row of checkIns) {
    for (const key of new Set(keysOf(row))) {
      const g = groups.get(key) ?? { rows: [], athletes: new Set<string>() }
      g.rows.push(row)
      g.athletes.add(row.participant)
      groups.set(key, g)
    }
  }
  const shown: Item[] = []
  const other = { count: 0, athletes: new Set<string>(), intensities: [] as number[] }
  const all = [...groups.entries()].sort((a, b) => b[1].rows.length - a[1].rows.length)
  for (const [key, g] of all) {
    const intensities = g.rows.map((r) => r.intensity).filter((v): v is number => v !== null)
    if (g.athletes.size >= MIN_ATHLETES && shown.length < TOP) {
      shown.push({ label: key, count: g.rows.length, athletes: g.athletes.size, meanIntensity: mean(intensities), extra: extraOf?.(key) })
    } else {
      other.count += g.rows.length
      g.athletes.forEach((a) => other.athletes.add(a))
      other.intensities.push(...intensities)
    }
  }
  if (other.count > 0) {
    shown.push({ label: 'Other', count: other.count, athletes: other.athletes.size, meanIntensity: mean(other.intensities) })
  }
  return shown
}

/** averages of one group, hidden when fewer than MIN_ATHLETES athletes are in it */
const groupStats = (rows: ResearchCheckinRow[]) => {
  const athletes = new Set(rows.map((r) => r.participant)).size
  const ok = athletes >= MIN_ATHLETES
  const pain = rows.filter((r) => r.category === 'pain').length
  return {
    checkIns: rows.length,
    athletes,
    meanIntensity: ok ? mean(rows.map((r) => r.intensity).filter((v): v is number => v !== null)) : null,
    meanEnergy: ok ? mean(rows.map((r) => r.energy).filter((v): v is number => v !== null)) : null,
    painSharePct: ok && rows.length ? Math.round((100 * pain) / rows.length) : null,
  }
}

const isoWeekStart = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`)
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000)
  return monday.toISOString().slice(0, 10)
}

export const computeResearchMetrics = (allRows: ResearchCheckinRow[], range?: { from: string; to: string }) => {
  const rows = range ? allRows.filter((r) => r.date >= range.from && r.date <= range.to) : allRows
  const checkIns = rows.filter((r) => r.record === 'check-in')
  const participants = new Set(rows.map((r) => r.participant))
  const perAthlete = [...participants].map((p) => checkIns.filter((r) => r.participant === p).length)
  const enough = participants.size >= MIN_ATHLETES
  const dates = rows.map((r) => r.date).sort()
  const wordCategory = new Map(checkIns.filter((r) => r.word).map((r) => [r.word as string, r.category ?? '']))

  const intensity = Array.from({ length: 11 }, (_, level) => ({
    level,
    count: checkIns.filter((r) => r.intensity === level).length,
  }))

  // one period answer per athlete per day, from any of her rows that day
  const periodOf = new Map(rows.filter((r) => r.on_period !== null).map((r) => [`${r.participant} ${r.date}`, r.on_period]))
  const painkillerOf = new Map(rows.filter((r) => r.took_painkiller !== null).map((r) => [`${r.participant} ${r.date}`, r.took_painkiller]))
  const withAnswer = (map: Map<string, boolean | null>, value: boolean) =>
    checkIns.filter((r) => map.get(`${r.participant} ${r.date}`) === value)

  const weeks = new Map<string, ResearchCheckinRow[]>()
  for (const r of checkIns) {
    const w = isoWeekStart(r.date)
    weeks.set(w, [...(weeks.get(w) ?? []), r])
  }

  return {
    minAthletes: MIN_ATHLETES,
    summary: {
      athletes: participants.size,
      checkIns: checkIns.length,
      medianPerAthlete: enough ? median(perAthlete) : null,
      firstDay: dates[0] ?? null,
      lastDay: dates[dates.length - 1] ?? null,
      meanIntensity: enough ? mean(checkIns.map((r) => r.intensity).filter((v): v is number => v !== null)) : null,
    },
    words: enough ? ranked(checkIns, (r) => (r.word ? [r.word] : []), (word) => wordCategory.get(word) ?? '') : [],
    categories: enough ? ranked(checkIns, (r) => (r.category ? [r.category] : [])) : [],
    zones: enough ? ranked(checkIns, (r) => (r.body_zones ?? []).map(zoneRegion)) : [],
    triggers: enough ? ranked(checkIns, (r) => r.triggers ?? []) : [],
    intensity: enough ? intensity : [],
    period: { yes: groupStats(withAnswer(periodOf, true)), no: groupStats(withAnswer(periodOf, false)) },
    painkiller: { yes: groupStats(withAnswer(painkillerOf, true)), no: groupStats(withAnswer(painkillerOf, false)) },
    weeks: [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([from, list]) => {
        const athletes = new Set(list.map((r) => r.participant)).size
        return {
          from,
          checkIns: list.length,
          athletes: athletes >= MIN_ATHLETES ? athletes : null,
          meanIntensity: athletes >= MIN_ATHLETES ? mean(list.map((r) => r.intensity).filter((v): v is number => v !== null)) : null,
        }
      }),
  }
}
