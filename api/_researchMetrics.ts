/**
 * Analyses of the check-ins athletes sent (research_checkins + the routine in research_participants),
 * for the dashboard's "Check-ins" tab. Built around the pilot's goals:
 *   1. body literacy  — does each athlete describe her body more precisely over time?
 *   2. what they feel — words, areas, moments, counted by athletes (not by check-ins)
 *   3. cycle          — within each athlete: period days vs her other days
 *   4. training       — within each athlete: after a session vs rest days (routine = objective load)
 *   5. data for a future model — how many days each athlete covers
 *
 * Only aggregates leave this function: no notes, no row, no participant code. Every figure needs at
 * least MIN_ATHLETES different athletes, otherwise it comes back as null / "Other".
 * (Files in api/ starting with "_" are not deployed as endpoints.)
 */

export const MIN_ATHLETES = 3

/** Positive words: their intensity means "how strong / light", not discomfort. Same list as
 * src/entities/check-in/vasScale.ts. A day with only these is a "good day". */
export const POSITIVE_WORD_IDS = new Set(['strong', 'light'])

/** Each word's signal as defined in src/entities/word/words.ts (a test keeps the two in sync). */
export const WORD_SIGNALS: Record<string, 'green' | 'yellow' | 'red'> = { strong: 'green', light: 'green', sore: 'green', achy: 'green', tight: 'green', stiff: 'green', unstable: 'yellow', crampy: 'yellow', gripping: 'yellow', sharp: 'red', stabbing: 'red', burning: 'green', tingling: 'yellow', numb: 'red', bloated: 'green', tender: 'green', nauseous: 'yellow', swollen: 'green', hot: 'green', heavy: 'green', dizzy: 'yellow', headachy: 'green', foggy: 'yellow', shaky: 'yellow' }

export type ResearchCheckinRow = {
  participant: string
  record: 'check-in' | 'day'
  date: string
  time: string | null
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

export type RoutineSession = { day: number; kind: 'training' | 'match'; start: string; end: string }
export type ParticipantRow = { code: string; routine: RoutineSession[] | null }

/** kneeLeft → knee, kneeLeftBack → knee (back), head → head */
export const zoneRegion = (zone: string): string => {
  const back = zone.endsWith('Back') && !/^(upper|mid|lower)Back/.test(zone)
  const base = (back ? zone.slice(0, -4) : zone).replace(/(Left|Right)$/, '')
  const name = base.replace(/([A-Z])/g, ' $1').toLowerCase()
  return back ? `${name} (back)` : name
}

// ── small helpers ──────────────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000
const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`)
const daysBetween = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY_MS)
const shiftDay = (day: string, n: number) => new Date(toTime(day) + n * DAY_MS).toISOString().slice(0, 10)
const isoWeekday = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}
const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? round1(values.reduce((a, b) => a + b, 0) / values.length) : null)
const median = (values: number[]) => {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : round1((s[m - 1] + s[m]) / 2)
}
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : null)
const groupBy = <T,>(items: T[], key: (item: T) => string) => {
  const map = new Map<string, T[]>()
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item])
  return map
}

const isPositive = (r: ResearchCheckinRow) => r.word_id !== null && POSITIVE_WORD_IDS.has(r.word_id)
const isSymptom = (r: ResearchCheckinRow) => r.record === 'check-in' && !isPositive(r)
const isAlert = (r: ResearchCheckinRow) => isSymptom(r) && WORD_SIGNALS[r.word_id ?? ''] !== undefined && WORD_SIGNALS[r.word_id ?? ''] !== 'green'
const intensities = (rows: ResearchCheckinRow[]) => rows.filter(isSymptom).map((r) => r.intensity).filter((v): v is number => v !== null)
const energies = (rows: ResearchCheckinRow[]) => rows.map((r) => r.energy).filter((v): v is number => v !== null)
/** a body area more precise than "the whole body" */
const hasPreciseZone = (r: ResearchCheckinRow) => (r.body_zones ?? []).some((z) => z !== 'whole')

/** Within-athlete comparisons: how many athletes go up / stay / go down, and the median change. */
type Direction = { athletes: number; up: number | null; same: number | null; down: number | null; medianChange: number | null; medianBefore: number | null; medianAfter: number | null }
const directions = (pairs: { before: number; after: number }[], tolerance: number): Direction => {
  const ok = pairs.length >= MIN_ATHLETES
  const change = pairs.map((p) => round1(p.after - p.before))
  return {
    athletes: pairs.length,
    up: ok ? change.filter((c) => c > tolerance).length : null,
    same: ok ? change.filter((c) => Math.abs(c) <= tolerance).length : null,
    down: ok ? change.filter((c) => c < -tolerance).length : null,
    medianChange: ok ? median(change) : null,
    medianBefore: ok ? median(pairs.map((p) => p.before)) : null,
    medianAfter: ok ? median(pairs.map((p) => p.after)) : null,
  }
}

/** counts per key by number of athletes; named only with ≥ MIN_ATHLETES athletes, the rest is "Other" */
type Item = { label: string; athletes: number; checkIns: number; meanIntensity: number | null; signal?: string }
const byAthletes = (
  rows: ResearchCheckinRow[],
  keysOf: (row: ResearchCheckinRow) => string[],
  signalOf?: (key: string) => string,
): Item[] => {
  const groups = new Map<string, { rows: ResearchCheckinRow[]; athletes: Set<string> }>()
  for (const row of rows) {
    for (const key of new Set(keysOf(row))) {
      const g = groups.get(key) ?? { rows: [], athletes: new Set<string>() }
      g.rows.push(row)
      g.athletes.add(row.participant)
      groups.set(key, g)
    }
  }
  const shown: Item[] = []
  const other = { rows: [] as ResearchCheckinRow[], athletes: new Set<string>() }
  const sorted = [...groups.entries()].sort((a, b) => b[1].athletes.size - a[1].athletes.size || b[1].rows.length - a[1].rows.length)
  for (const [key, g] of sorted) {
    if (g.athletes.size >= MIN_ATHLETES) {
      shown.push({ label: key, athletes: g.athletes.size, checkIns: g.rows.length, meanIntensity: mean(intensities(g.rows)), ...(signalOf ? { signal: signalOf(key) } : {}) })
    } else {
      other.rows.push(...g.rows)
      g.athletes.forEach((a) => other.athletes.add(a))
    }
  }
  if (other.rows.length > 0) {
    shown.push({ label: 'Other', athletes: other.athletes.size, checkIns: other.rows.length, meanIntensity: mean(intensities(other.rows)) })
  }
  return shown
}

// ── the analyses ───────────────────────────────────────────────────────────────────────────────

/** check-ins compared between an athlete's first and last ones */
export const LITERACY_WINDOW = 5
/** she needs at least this many check-ins, spread over at least LITERACY_MIN_DAYS days */
export const LITERACY_MIN_CHECKINS = 2 * LITERACY_WINDOW
export const LITERACY_MIN_DAYS = 14

const literacy = (checkInsByAthlete: Map<string, ResearchCheckinRow[]>) => {
  const vocabulary: { before: number; after: number }[] = []
  const precision: { before: number; after: number }[] = []
  const moments: { before: number; after: number }[] = []
  for (const list of checkInsByAthlete.values()) {
    const ordered = [...list].sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`))
    if (ordered.length < LITERACY_MIN_CHECKINS) continue
    if (daysBetween(ordered[0].date, ordered[ordered.length - 1].date) < LITERACY_MIN_DAYS) continue
    const first = ordered.slice(0, LITERACY_WINDOW)
    const last = ordered.slice(-LITERACY_WINDOW)
    // different words in the same number of check-ins: a richer vocabulary
    vocabulary.push({ before: new Set(first.map((r) => r.word_id)).size, after: new Set(last.map((r) => r.word_id)).size })
    // among symptoms: a precise body area, and saying when it shows up
    const share = (rows: ResearchCheckinRow[], test: (r: ResearchCheckinRow) => boolean) => {
      const symptoms = rows.filter(isSymptom)
      return symptoms.length ? pct(symptoms.filter(test).length, symptoms.length) : null
    }
    const pb = share(first, hasPreciseZone)
    const pa = share(last, hasPreciseZone)
    if (pb !== null && pa !== null) precision.push({ before: pb, after: pa })
    const mb = share(first, (r) => (r.triggers ?? []).length > 0)
    const ma = share(last, (r) => (r.triggers ?? []).length > 0)
    if (mb !== null && ma !== null) moments.push({ before: mb, after: ma })
  }
  return {
    window: LITERACY_WINDOW,
    minCheckIns: LITERACY_MIN_CHECKINS,
    minDays: LITERACY_MIN_DAYS,
    vocabulary: directions(vocabulary, 0),
    precision: directions(precision, 10),
    moments: directions(moments, 10),
  }
}

/** within each athlete: symptoms on period days vs her other days */
const cycle = (rows: ResearchCheckinRow[]) => {
  // one period / painkiller answer per athlete per day, from any of her rows that day
  const answer = (field: 'on_period' | 'took_painkiller') =>
    new Map(rows.filter((r) => r[field] !== null).map((r) => [`${r.participant} ${r.date}`, r[field] as boolean]))
  const period = answer('on_period')
  const painkiller = answer('took_painkiller')
  const intensity: { before: number; after: number }[] = []
  const energy: { before: number; after: number }[] = []
  const alert: { before: number; after: number }[] = []
  for (const [, list] of groupBy(rows.filter((r) => r.record === 'check-in'), (r) => r.participant)) {
    const on = list.filter((r) => period.get(`${r.participant} ${r.date}`) === true)
    const off = list.filter((r) => period.get(`${r.participant} ${r.date}`) === false)
    const [ion, ioff] = [intensities(on), intensities(off)]
    if (ion.length >= 2 && ioff.length >= 2) intensity.push({ before: mean(ioff)!, after: mean(ion)! })
    const [eon, eoff] = [energies(on), energies(off)]
    if (eon.length >= 2 && eoff.length >= 2) energy.push({ before: mean(eoff)!, after: mean(eon)! })
    const [son, soff] = [on.filter(isSymptom), off.filter(isSymptom)]
    if (son.length >= 2 && soff.length >= 2) {
      alert.push({ before: pct(soff.filter(isAlert).length, soff.length)!, after: pct(son.filter(isAlert).length, son.length)! })
    }
  }
  // painkillers: share of the answered days, on period days vs other days
  const days = [...painkiller.entries()].map(([key, took]) => ({ athlete: key.split(' ')[0], took, onPeriod: period.get(key) }))
  const share = (list: typeof days) => {
    const athletes = new Set(list.map((d) => d.athlete)).size
    return { days: list.length, athletes, pct: athletes >= MIN_ATHLETES ? pct(list.filter((d) => d.took).length, list.length) : null }
  }
  return {
    intensity: directions(intensity, 0.5),
    energy: directions(energy, 0.5),
    alert: directions(alert, 10),
    painkiller: { period: share(days.filter((d) => d.onPeriod === true)), other: share(days.filter((d) => d.onPeriod === false)) },
  }
}

/** a check-in up to this long before a session starts, or after it ends, belongs to it */
export const SESSION_WINDOW_MINUTES = 4 * 60
export const MOMENTS = ['After a match', 'After training', 'Before a session', 'Day after a match', 'Rest day', 'Other, session day'] as const
type Moment = (typeof MOMENTS)[number]

export const momentOf = (date: string, time: string | null, routine: RoutineSession[]): Moment | null => {
  const today = routine.filter((s) => s.day === isoWeekday(date))
  const yesterdayMatch = routine.some((s) => s.kind === 'match' && s.day === isoWeekday(shiftDay(date, -1)))
  if (today.length === 0) return yesterdayMatch ? 'Day after a match' : 'Rest day'
  if (time === null) return null
  const minute = minutesOf(time)
  const after = today.find((s) => minute > minutesOf(s.end) && minute <= minutesOf(s.end) + SESSION_WINDOW_MINUTES)
  if (after) return after.kind === 'match' ? 'After a match' : 'After training'
  if (today.some((s) => minute >= minutesOf(s.start) - SESSION_WINDOW_MINUTES && minute < minutesOf(s.start))) return 'Before a session'
  return 'Other, session day'
}

const training = (rows: ResearchCheckinRow[], routines: Map<string, RoutineSession[]>) => {
  const withRoutine = [...routines.entries()].filter(([, r]) => r.length > 0)
  const ok = withRoutine.length >= MIN_ATHLETES
  const minutes = withRoutine.map(([, r]) => r.reduce((sum, s) => sum + Math.max(minutesOf(s.end) - minutesOf(s.start), 0), 0))
  const matches = withRoutine.map(([, r]) => r.filter((s) => s.kind === 'match').length)
  const sessions = withRoutine.map(([, r]) => r.length)

  const tagged = rows
    .filter((r) => r.record === 'check-in' && (routines.get(r.participant)?.length ?? 0) > 0)
    .map((r) => ({ row: r, moment: momentOf(r.date, r.time, routines.get(r.participant)!) }))
  const moments = MOMENTS.map((moment) => {
    const list = tagged.filter((t) => t.moment === moment).map((t) => t.row)
    const athletes = new Set(list.map((r) => r.participant)).size
    const shown = athletes >= MIN_ATHLETES
    const symptoms = list.filter(isSymptom)
    return {
      label: moment,
      checkIns: list.length,
      athletes,
      meanIntensity: shown ? mean(intensities(list)) : null,
      alertSharePct: shown ? pct(symptoms.filter(isAlert).length, symptoms.length) : null,
      positiveSharePct: shown ? pct(list.filter(isPositive).length, list.length) : null,
    }
  })
  // within each athlete: symptoms after a session (training or match) vs on her rest days
  const pairs: { before: number; after: number }[] = []
  for (const [, list] of groupBy(tagged, (t) => t.row.participant)) {
    const after = intensities(list.filter((t) => t.moment === 'After a match' || t.moment === 'After training').map((t) => t.row))
    const rest = intensities(list.filter((t) => t.moment === 'Rest day').map((t) => t.row))
    if (after.length >= 2 && rest.length >= 2) pairs.push({ before: mean(rest)!, after: mean(after)! })
  }
  return {
    athletesWithRoutine: withRoutine.length,
    planned: {
      minutesPerWeek: ok ? median(minutes) : null,
      sessionsPerWeek: ok ? median(sessions) : null,
      matchesPerWeek: ok ? median(matches) : null,
    },
    moments,
    afterSessionVsRest: directions(pairs, 0.5),
  }
}

/** how many days each athlete covers: good days, days with a symptom, days without data */
const coverage = (rows: ResearchCheckinRow[], until: string | null) => {
  const perAthlete = [...groupBy(rows, (r) => r.participant).values()].map((list) => {
    const first = list.reduce((min, r) => (r.date < min ? r.date : min), list[0].date)
    const last = until ?? list.reduce((max, r) => (r.date > max ? r.date : max), list[0].date)
    const span = Math.max(daysBetween(first, last) + 1, 1)
    const byDay = groupBy(list, (r) => r.date)
    let good = 0
    let symptom = 0
    let answerOnly = 0
    for (const dayRows of byDay.values()) {
      if (dayRows.some(isSymptom)) symptom += 1
      else if (dayRows.some(isPositive)) good += 1
      else answerOnly += 1
    }
    return { span, good, symptom, answerOnly, none: Math.max(span - byDay.size, 0), coveredPct: pct(byDay.size, span) ?? 0 }
  })
  const ok = perAthlete.length >= MIN_ATHLETES
  const bands = [
    { label: 'under 25%', min: 0, max: 25 },
    { label: '25–50%', min: 25, max: 50 },
    { label: '50–75%', min: 50, max: 75 },
    { label: '75% or more', min: 75, max: 101 },
  ]
  return {
    athletes: perAthlete.length,
    bands: ok ? bands.map((b) => ({ label: b.label, athletes: perAthlete.filter((a) => a.coveredPct >= b.min && a.coveredPct < b.max).length })) : [],
    /** median days per athlete */
    days: ok
      ? {
          span: median(perAthlete.map((a) => a.span)),
          good: median(perAthlete.map((a) => a.good)),
          symptom: median(perAthlete.map((a) => a.symptom)),
          answerOnly: median(perAthlete.map((a) => a.answerOnly)),
          none: median(perAthlete.map((a) => a.none)),
        }
      : null,
    medianCoveredPct: ok ? median(perAthlete.map((a) => a.coveredPct)) : null,
  }
}

export const computeResearchMetrics = (
  allRows: ResearchCheckinRow[],
  participants: ParticipantRow[] = [],
  range?: { from: string; to: string },
) => {
  const rows = range ? allRows.filter((r) => r.date >= range.from && r.date <= range.to) : allRows
  const checkIns = rows.filter((r) => r.record === 'check-in')
  const athletes = new Set(rows.map((r) => r.participant))
  const enough = athletes.size >= MIN_ATHLETES
  const dates = rows.map((r) => r.date).sort()
  const lastDay = dates[dates.length - 1] ?? null
  const routines = new Map(participants.filter((p) => athletes.has(p.code)).map((p) => [p.code, p.routine ?? []]))
  const signalOf = (word: string) => {
    const id = checkIns.find((r) => r.word === word)?.word_id ?? ''
    return POSITIVE_WORD_IDS.has(id) ? 'positive' : WORD_SIGNALS[id] ?? ''
  }
  // days are counted up to the last day anyone sent something: an athlete who stopped earlier has empty days
  const cov = coverage(rows, lastDay)

  return {
    minAthletes: MIN_ATHLETES,
    summary: {
      athletes: athletes.size,
      checkIns: checkIns.length,
      firstDay: dates[0] ?? null,
      lastDay,
      medianPerAthlete: enough ? median([...athletes].map((a) => checkIns.filter((r) => r.participant === a).length)) : null,
      medianCoveredPct: cov.medianCoveredPct,
      athletesWithRoutine: [...routines.values()].filter((r) => r.length > 0).length,
    },
    literacy: literacy(groupBy(checkIns, (r) => r.participant)),
    feel: {
      words: enough ? byAthletes(checkIns, (r) => (r.word ? [r.word] : []), signalOf) : [],
      zones: enough ? byAthletes(checkIns.filter(isSymptom), (r) => (r.body_zones ?? []).map(zoneRegion)) : [],
      moments: enough ? byAthletes(checkIns.filter(isSymptom), (r) => r.triggers ?? []) : [],
    },
    cycle: cycle(rows),
    training: training(rows, routines),
    coverage: cov,
  }
}
