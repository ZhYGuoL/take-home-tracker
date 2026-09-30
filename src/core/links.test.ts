import { describe, expect, it } from 'vitest'
import { normalizeUrl, shortUrl } from './links'

describe('normalizeUrl', () => {
  it.each([
    ['https://pantry.example.com', 'https://pantry.example.com/'],
    ['pantry.example.com/app', 'https://pantry.example.com/app'],
    ['  github.com/example-rowan/pantry  ', 'https://github.com/example-rowan/pantry'],
  ])('%s becomes %s', (raw, out) => {
    expect(normalizeUrl(raw)).toBe(out)
  })

  it.each(['', 'not a link', 'javascript:alert(1)', 'ftp://files.example.com', 'localhost'])(
    'rejects %j',
    (raw) => {
      expect(normalizeUrl(raw)).toBeNull()
    },
  )
})

describe('shortUrl', () => {
  it('drops the scheme, www, and a trailing slash', () => {
    expect(shortUrl('https://www.example.com/')).toBe('example.com')
    expect(shortUrl('https://github.com/example-rowan/pantry/')).toBe(
      'github.com/example-rowan/pantry',
    )
  })
})
