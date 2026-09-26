/// <reference types="node" />
import { isTimeZone, json, supabase, TABLE, TIME } from './_reminders.js'
import { b64u, isPushEndpoint } from './_webpush.js'

/**
 * The daily reminder of the web app (the website installed on the home screen).
 * The native app schedules its reminder on the phone; a website can't, so the phone registers
 * here and api/send-reminders.ts sends the notification at the chosen time.
 *
 * GET     → { publicKey }  the key the phone needs to subscribe to notifications
 * PUT     { subscription, time, timeZone, title, body }  turns the reminder on or updates it
 * DELETE  { endpoint }  turns it off: the row is deleted
 *
 * What is stored: the address the phone's push service gave for BAB (random, it names no person),
 * the time, the time zone and the text in the athlete's language. Nothing links it to the usage
 * statistics. A row disappears when the reminder is switched off, when the push service says the
 * address no longer exists, or after 60 days without the app being opened.
 *
 * Environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (as for api/usage.ts),
 * VAPID_PUBLIC_KEY (from scripts/vapid-keys.mjs).
 */

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max

const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VAPID_PUBLIC_KEY)

const readJson = async (request: Request): Promise<Record<string, unknown> | null> => {
  try {
    const body = (await request.json()) as unknown
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function GET(): Response {
  if (!configured()) return json(503, { error: 'not_configured' })
  return json(200, { publicKey: process.env.VAPID_PUBLIC_KEY })
}

export async function PUT(request: Request): Promise<Response> {
  if (!configured()) return json(503, { error: 'not_configured' })
  const body = await readJson(request)
  const subscription = body?.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined
  const p256dh = subscription?.keys?.p256dh
  const auth = subscription?.keys?.auth
  if (
    !body ||
    !isPushEndpoint(subscription?.endpoint) ||
    typeof p256dh !== 'string' ||
    b64u.decode(p256dh).length !== 65 ||
    typeof auth !== 'string' ||
    b64u.decode(auth).length !== 16 ||
    typeof body.time !== 'string' ||
    !TIME.test(body.time) ||
    !isTimeZone(body.timeZone) ||
    !text(body.title, 60) ||
    !text(body.body, 200)
  ) {
    return json(400, { error: 'invalid' })
  }

  const row = {
    endpoint: subscription!.endpoint,
    p256dh,
    auth,
    remind_at: body.time,
    time_zone: body.timeZone,
    title: body.title,
    body: body.body,
    updated_at: new Date().toISOString(),
  }
  // insert, or update the same phone's row (last_sent_day is left as it is)
  const response = await supabase(`${TABLE}?on_conflict=endpoint`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  if (!response.ok) {
    console.error('Could not save the reminder', response.status, await response.text())
    return json(502, { error: 'database' })
  }
  return json(200, { ok: true })
}

export async function DELETE(request: Request): Promise<Response> {
  if (!configured()) return json(503, { error: 'not_configured' })
  const body = await readJson(request)
  if (!body || !isPushEndpoint(body.endpoint)) return json(400, { error: 'invalid' })
  const response = await supabase(`${TABLE}?endpoint=eq.${encodeURIComponent(body.endpoint)}`, { method: 'DELETE' })
  if (!response.ok) {
    console.error('Could not delete the reminder', response.status, await response.text())
    return json(502, { error: 'database' })
  }
  return json(200, { ok: true })
}
