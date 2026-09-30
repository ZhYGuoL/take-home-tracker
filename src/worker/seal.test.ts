import { describe, expect, it } from 'vitest'
import { randomToken, seal, sha256Base64Url, unseal } from './seal'

const SECRET = 'a-test-secret-that-is-long-enough-0001'

describe('seal', () => {
  it('round-trips a value', async () => {
    const s = await seal({ sub: 'u1', email: 'a@example.com' }, SECRET)
    expect(s.startsWith('v1.')).toBe(true)
    expect(await unseal(s, SECRET)).toEqual({ sub: 'u1', email: 'a@example.com' })
  })

  it('does not show the value in the cookie', async () => {
    const s = await seal({ email: 'private@example.com' }, SECRET)
    expect(s).not.toContain('private')
  })

  it('refuses a changed cookie, another secret, or garbage', async () => {
    const s = await seal({ sub: 'u1' }, SECRET)
    const flipped = `${s.slice(0, -2)}${s.at(-2) === 'A' ? 'B' : 'A'}${s.at(-1)}`
    expect(await unseal(flipped, SECRET)).toBeNull()
    expect(await unseal(s, 'another-secret-that-is-long-enough-000')).toBeNull()
    expect(await unseal('v1.!!!', SECRET)).toBeNull()
    expect(await unseal(undefined, SECRET)).toBeNull()
  })
})

describe('PKCE helpers', () => {
  it('hashes a verifier the way Google checks it (SHA-256, base64url)', async () => {
    // Computed once with Node: createHash('sha256').update(verifier).digest('base64url').
    const verifier = 'dBjftJeZ4CVP-mJ92K9HPYSjOjDGJeN4ytRyYz8dI2O6aLdeY8iNX-kzDqgdzxT4ZeI'
    expect(await sha256Base64Url(verifier)).toBe('la41SprJ9PN6_vBs_3ardrRPCJMwQsMwyM6z_l1kTnI')
  })

  it('makes random url-safe tokens', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(randomToken())
  })
})
