/// <reference types="node" />
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto'

/**
 * Web Push without dependencies: encrypts the message for one browser (RFC 8291, aes128gcm)
 * and signs the request with the server's VAPID key (RFC 8292), using only node:crypto.
 * (Files in api/ starting with "_" are not deployed as endpoints.)
 */

export type PushSubscription = { endpoint: string; p256dh: string; auth: string }
export type VapidKeys = { publicKey: string; privateKey: string; subject: string }

export const b64u = {
  encode: (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url'),
  decode: (text: string): Buffer => Buffer.from(text, 'base64url'),
}

const hmac = (key: Uint8Array, data: Uint8Array) => createHmac('sha256', key).update(data).digest()
const RECORD_SIZE = 4096

/**
 * The encrypted body for one subscription. `salt` and `serverKeys` are only passed by tests
 * (to check against the RFC's example); normally both are fresh for every message.
 */
export const encryptPayload = (
  plaintext: Uint8Array,
  p256dh: string,
  auth: string,
  salt: Uint8Array = randomBytes(16),
  serverKeys?: { privateKey: string },
): Buffer => {
  const uaPublic = b64u.decode(p256dh)
  const authSecret = b64u.decode(auth)
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('invalid subscription keys')

  const ecdh = createECDH('prime256v1')
  if (serverKeys) ecdh.setPrivateKey(b64u.decode(serverKeys.privateKey))
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const sharedSecret = ecdh.computeSecret(uaPublic)

  const prkKey = hmac(authSecret, sharedSecret)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])])
  const ikm = hmac(prkKey, keyInfo)
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)

  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  // a single record: the content, then the 0x02 delimiter that marks it as the last one
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(16 + 4 + 1)
  Buffer.from(salt).copy(header, 0)
  header.writeUInt32BE(RECORD_SIZE, 16)
  header.writeUInt8(asPublic.length, 20)
  return Buffer.concat([header, asPublic, encrypted])
}

/** The Authorization header that proves the message comes from this server (VAPID, ES256 JWT). */
export const vapidAuthorization = (endpoint: string, keys: VapidKeys, now = Date.now()): string => {
  const publicKey = b64u.decode(keys.publicKey)
  const key = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64u.encode(publicKey.subarray(1, 33)),
      y: b64u.encode(publicKey.subarray(33, 65)),
      d: b64u.encode(Buffer.concat([Buffer.alloc(32), b64u.decode(keys.privateKey)]).subarray(-32)),
    },
    format: 'jwk',
  })
  const json = (value: unknown) => b64u.encode(Buffer.from(JSON.stringify(value)))
  const unsigned = `${json({ typ: 'JWT', alg: 'ES256' })}.${json({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: keys.subject,
  })}`
  const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${unsigned}.${b64u.encode(signature)}, k=${keys.publicKey}`
}

/**
 * Sends one notification. Returns the push service's status: 201 = delivered to the service,
 * 404/410 = the subscription no longer exists (the athlete uninstalled or turned notifications off).
 */
export const sendPush = async (
  subscription: PushSubscription,
  message: unknown,
  keys: VapidKeys,
  fetcher: typeof fetch = fetch,
): Promise<number> => {
  const body = encryptPayload(Buffer.from(JSON.stringify(message)), subscription.p256dh, subscription.auth)
  const response = await fetcher(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, keys),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      // a reminder that arrives hours late is pointless
      TTL: String(4 * 3600),
      Urgency: 'normal',
    },
    body: new Uint8Array(body),
  })
  return response.status
}

/** Push services browsers use; a subscription pointing anywhere else is refused. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Android
  /^web\.push\.apple\.com$/, // Safari, iPhone
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /\.notify\.windows\.com$/, // Edge
  /^[a-z0-9.-]+\.push\.apple\.com$/,
]

export const isPushEndpoint = (endpoint: unknown): endpoint is string => {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && PUSH_HOSTS.some((host) => host.test(url.hostname))
  } catch {
    return false
  }
}
