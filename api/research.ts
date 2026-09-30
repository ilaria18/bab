/// <reference types="node" />
import { createHash, timingSafeEqual } from 'node:crypto'
import { json, supabase } from './_reminders.js'

/**
 * The pilot's research data: an athlete's check-ins, sent from her phone only when she taps
 * "Send my data" and confirms (src/features/data-export).
 *
 * POST    { code, token, consentVersion, rows }  stores her rows, replacing what she sent before
 * DELETE  { code, token }                        deletes everything she sent
 *
 * Tables (analytics/setup.sql): research_participants, research_checkins.
 * No name, no contact, no IP or device id is stored: `code` is a random 6-character code made on
 * the phone. `token` is a secret only that phone has; only its SHA-256 is stored, and every
 * replace/delete must present it, so nobody else can overwrite or erase an athlete's data.
 * These are health data of minors: the tables are readable only with the server's secret key.
 *
 * Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (as for api/usage.ts).
 */

const CODE = /^[A-HJ-NP-Z2-9]{6}$/
const TOKEN = /^[0-9a-f]{64}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const ID = /^[A-Za-z0-9_-]{1,64}$/
const ZONE = /^[A-Za-z]{2,30}$/
const TRIGGERS = ['movement', 'pressure', 'stillness']
const MAX_ROWS = 3000
const MAX_NOTE = 2000

type Row = {
  participant: string
  record_id: string
  record: 'check-in' | 'day'
  date: string
  time: string | null
  word_id: string | null
  word: string | null
  category: string | null
  intensity: number | null
  energy: number | null
  triggers: string[]
  body_zones: string[]
  on_period: boolean | null
  took_painkiller: boolean | null
  note: string | null
}

const optionalText = (value: unknown, max: number, pattern?: RegExp): string | null | undefined => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > max || (pattern && !pattern.test(value))) return undefined
  return value
}
const optionalInt = (value: unknown, min: number, max: number): number | null | undefined => {
  if (value === null || value === undefined) return null
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max ? (value as number) : undefined
}
const optionalBool = (value: unknown): boolean | null | undefined =>
  value === null || value === undefined ? null : typeof value === 'boolean' ? value : undefined

/** Rebuilt field by field: anything else the client sends is dropped. Null if a field is invalid. */
export const toResearchRow = (participant: string, input: unknown): Row | null => {
  if (typeof input !== 'object' || input === null) return null
  const r = input as Record<string, unknown>
  if (typeof r.record_id !== 'string' || !ID.test(r.record_id)) return null
  if (r.record !== 'check-in' && r.record !== 'day') return null
  if (typeof r.date !== 'string' || !DAY.test(r.date)) return null
  const time = optionalText(r.time, 5, TIME)
  const wordId = optionalText(r.word_id, 64, ID)
  const word = optionalText(r.word, 80)
  const category = optionalText(r.category, 40, ID)
  const intensity = optionalInt(r.intensity, 0, 10)
  const energy = optionalInt(r.energy, 1, 7)
  const onPeriod = optionalBool(r.on_period)
  const painkiller = optionalBool(r.took_painkiller)
  const note = optionalText(r.note, MAX_NOTE)
  const triggers = r.triggers ?? []
  const zones = r.body_zones ?? []
  if ([time, wordId, word, category, intensity, energy, onPeriod, painkiller, note].includes(undefined)) return null
  if (!Array.isArray(triggers) || !triggers.every((t) => TRIGGERS.includes(t as string))) return null
  if (!Array.isArray(zones) || zones.length > 80 || !zones.every((z) => typeof z === 'string' && ZONE.test(z))) return null
  return {
    participant,
    record_id: r.record_id,
    record: r.record,
    date: r.date,
    time: time as string | null,
    word_id: wordId as string | null,
    word: word as string | null,
    category: category as string | null,
    intensity: intensity as number | null,
    energy: energy as number | null,
    triggers: [...new Set(triggers as string[])],
    body_zones: [...new Set(zones as string[])],
    on_period: onPeriod as boolean | null,
    took_painkiller: painkiller as boolean | null,
    note: note as string | null,
  }
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')
const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = (await request.json()) as unknown
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/** 'new' if no one has used this code yet, 'ok' if the token matches, 'forbidden' otherwise */
const checkOwner = async (code: string, token: string): Promise<'new' | 'ok' | 'forbidden'> => {
  const response = await supabase(`research_participants?code=eq.${code}&select=token_hash`)
  if (!response.ok) throw new Error(`participants: ${response.status} ${await response.text()}`)
  const [existing] = (await response.json()) as { token_hash: string }[]
  if (!existing) return 'new'
  return sameHash(existing.token_hash, hash(token)) ? 'ok' : 'forbidden'
}

const failed = async (what: string, response: Response) => {
  console.error(`Could not ${what}`, response.status, await response.text())
  return json(502, { error: 'database' })
}

export async function POST(request: Request): Promise<Response> {
  if (!configured()) return json(503, { error: 'not_configured' })
  const body = await readJson(request)
  const code = body?.code
  const token = body?.token
  const consentVersion = body?.consentVersion
  if (
    typeof code !== 'string' ||
    !CODE.test(code) ||
    typeof token !== 'string' ||
    !TOKEN.test(token) ||
    typeof consentVersion !== 'string' ||
    consentVersion.length > 40 ||
    !Array.isArray(body?.rows) ||
    body.rows.length === 0 ||
    body.rows.length > MAX_ROWS
  ) {
    return json(400, { error: 'invalid' })
  }
  const rows = (body.rows as unknown[]).map((row) => toResearchRow(code, row))
  if (rows.some((row) => row === null)) return json(400, { error: 'invalid_row' })

  try {
    const owner = await checkOwner(code, token)
    if (owner === 'forbidden') return json(403, { error: 'forbidden' })
    const now = new Date().toISOString()
    const participant = { code, token_hash: hash(token), consent_version: consentVersion, updated_at: now }
    const saved =
      owner === 'new'
        ? await supabase('research_participants', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ ...participant, consented_at: now }),
          })
        : await supabase(`research_participants?code=eq.${code}`, {
            method: 'PATCH',
            body: JSON.stringify({ consent_version: consentVersion, updated_at: now }),
          })
    if (!saved.ok) return failed('save the participant', saved)

    // replace what this phone sent before, so check-ins deleted on the phone disappear here too
    const cleared = await supabase(`research_checkins?participant=eq.${code}`, { method: 'DELETE' })
    if (!cleared.ok) return failed('clear the old rows', cleared)
    const inserted = await supabase('research_checkins', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!inserted.ok) return failed('save the rows', inserted)
    return json(200, { ok: true, rows: rows.length })
  } catch (error) {
    console.error('Research upload failed', error)
    return json(502, { error: 'database' })
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!configured()) return json(503, { error: 'not_configured' })
  const body = await readJson(request)
  const code = body?.code
  const token = body?.token
  if (typeof code !== 'string' || !CODE.test(code) || typeof token !== 'string' || !TOKEN.test(token)) {
    return json(400, { error: 'invalid' })
  }
  try {
    const owner = await checkOwner(code, token)
    if (owner === 'forbidden') return json(403, { error: 'forbidden' })
    if (owner === 'new') return json(200, { ok: true }) // nothing was ever sent
    // the check-ins go with the participant (on delete cascade)
    const deleted = await supabase(`research_participants?code=eq.${code}`, { method: 'DELETE' })
    if (!deleted.ok) return failed('delete the participant', deleted)
    return json(200, { ok: true })
  } catch (error) {
    console.error('Research delete failed', error)
    return json(502, { error: 'database' })
  }
}
