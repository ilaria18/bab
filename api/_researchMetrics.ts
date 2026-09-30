/**
 * First analyses of the check-ins athletes sent (research_checkins), for the dashboard's
 * "Check-ins" tab. Only aggregates leave this function: no notes, no row, no participant code.
 * A word, body area or group is named only when at least MIN_ATHLETES different athletes are in
 * it; the rest is folded into "Other" (or hidden), so no single athlete's answers can be read off.
 * (Files in api/ starting with "_" are not deployed as endpoints.)
 */

export const MIN_ATHLETES = 3
/** at most this many named items (all 24 words fit) */
const TOP = 24

/** Positive words: their intensity means "how strong / light", not discomfort, so they are kept
 * out of every intensity average and counted apart. Same list as src/entities/check-in/vasScale.ts. */
export const POSITIVE_WORD_IDS = new Set(['strong', 'light'])

/** Each word's signal as defined in src/entities/word/words.ts (a test keeps the two in sync):
 * green = normal for an athlete, yellow = keep an eye on it, red = warning. */
export const WORD_SIGNALS: Record<string, 'green' | 'yellow' | 'red'> = { strong: 'green', light: 'green', sore: 'green', achy: 'green', tight: 'green', stiff: 'green', unstable: 'yellow', crampy: 'yellow', gripping: 'yellow', sharp: 'red', stabbing: 'red', burning: 'green', tingling: 'yellow', numb: 'red', bloated: 'green', tender: 'green', nauseous: 'yellow', swollen: 'green', hot: 'green', heavy: 'green', dizzy: 'yellow', headachy: 'green', foggy: 'yellow', shaky: 'yellow' }

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

const isPositive = (row: ResearchCheckinRow) => row.word_id !== null && POSITIVE_WORD_IDS.has(row.word_id)
/** intensity values of the symptom check-ins only (positive words left out) */
const symptomIntensities = (rows: ResearchCheckinRow[]) =>
  rows.filter((r) => !isPositive(r)).map((r) => r.intensity).filter((v): v is number => v !== null)

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
const ranked = (
  checkIns: ResearchCheckinRow[],
  keysOf: (row: ResearchCheckinRow) => string[],
  extraOf?: (key: string) => string,
  /** per word the intensity is homogeneous (a strong word's own scale); elsewhere symptoms only */
  intensitiesOf: (rows: ResearchCheckinRow[]) => number[] = symptomIntensities,
) => {
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
    const intensities = intensitiesOf(g.rows)
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
  const positive = rows.filter(isPositive).length
  const symptoms = rows.filter((r) => !isPositive(r))
  const alert = symptoms.filter((r) => r.word_id && WORD_SIGNALS[r.word_id] !== 'green').length
  const share = (part: number, whole: number) => (ok && whole ? Math.round((100 * part) / whole) : null)
  return {
    checkIns: rows.length,
    athletes,
    meanIntensity: ok ? mean(symptomIntensities(rows)) : null,
    meanEnergy: ok ? mean(rows.map((r) => r.energy).filter((v): v is number => v !== null)) : null,
    painSharePct: share(pain, rows.length),
    positiveSharePct: share(positive, rows.length),
    /** yellow or red words, among the symptom check-ins */
    alertSharePct: share(alert, symptoms.length),
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

  const symptoms = checkIns.filter((r) => !isPositive(r))
  const intensity = Array.from({ length: 11 }, (_, level) => ({
    level,
    count: symptoms.filter((r) => r.intensity === level).length,
  }))
  const signalOf = (r: ResearchCheckinRow) =>
    isPositive(r) ? 'Positive' : ({ green: 'Normal (green)', yellow: 'Watch (yellow)', red: 'Warning (red)' } as const)[WORD_SIGNALS[r.word_id ?? ''] ?? 'green']
  const SIGNAL_ORDER = ['Positive', 'Normal (green)', 'Watch (yellow)', 'Warning (red)']

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
      /** symptom check-ins only */
      meanIntensity: enough ? mean(symptomIntensities(checkIns)) : null,
      positiveSharePct: enough && checkIns.length ? Math.round((100 * checkIns.filter(isPositive).length) / checkIns.length) : null,
    },
    signals: enough
      ? SIGNAL_ORDER.map((label) => {
          const list = checkIns.filter((r) => r.word_id && signalOf(r) === label)
          const athletes = new Set(list.map((r) => r.participant)).size
          return { label, count: list.length, athletes, meanIntensity: athletes >= MIN_ATHLETES ? mean(symptomIntensities(list)) : null }
        })
      : [],
    words: enough
      ? ranked(checkIns, (r) => (r.word ? [r.word] : []), (word) => wordCategory.get(word) ?? '', (rows) =>
          rows.map((r) => r.intensity).filter((v): v is number => v !== null),
        )
      : [],
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
          meanIntensity: athletes >= MIN_ATHLETES ? mean(symptomIntensities(list)) : null,
        }
      }),
  }
}
