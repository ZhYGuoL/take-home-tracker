// Seals small values into cookies: AES-GCM with a key derived from SESSION_SECRET (D4).
const enc = new TextEncoder()
const dec = new TextDecoder()
const keys = new Map<string, Promise<CryptoKey>>()

function keyFor(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle
      .importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey'])
      .then((base) =>
        crypto.subtle.deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: enc.encode('take-home-tracker'),
            info: enc.encode('cookie v1'),
          },
          base,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt'],
        ),
      )
    keys.set(secret, key)
  }
  return key
}

const toB64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function seal(value: unknown, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await keyFor(secret),
    enc.encode(JSON.stringify(value)),
  )
  const out = new Uint8Array(12 + data.byteLength)
  out.set(iv)
  out.set(new Uint8Array(data), 12)
  return `v1.${toB64(out)}`
}

/** The sealed value, or null when it was changed, sealed with another secret, or is not ours. */
export async function unseal<T>(sealed: string | undefined, secret: string): Promise<T | null> {
  if (!sealed?.startsWith('v1.')) return null
  try {
    const bytes = fromB64(sealed.slice(3))
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes.slice(0, 12) },
      await keyFor(secret),
      bytes.slice(12),
    )
    return JSON.parse(dec.decode(plain)) as T
  } catch {
    return null
  }
}

export async function sha256Base64Url(text: string): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))))
}

export function randomToken(bytes = 32): string {
  return toB64(crypto.getRandomValues(new Uint8Array(bytes)))
}
