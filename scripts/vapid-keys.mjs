// Creates the key pair the server uses to sign web-app notifications (VAPID).
// Run once:  node scripts/vapid-keys.mjs
// and copy the two lines into Vercel → Settings → Environment Variables.
// Keep the private key secret; changing the keys later means every phone must turn the reminder on again.
import { createECDH } from 'node:crypto'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
console.log(`VAPID_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`)
// always 32 bytes, even when the key starts with zeros
console.log(`VAPID_PRIVATE_KEY=${Buffer.concat([Buffer.alloc(32), ecdh.getPrivateKey()]).subarray(-32).toString('base64url')}`)
