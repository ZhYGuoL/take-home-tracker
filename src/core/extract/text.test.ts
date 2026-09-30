import { describe, expect, it } from 'vitest'
import { findLinks, findUrls, linkKind, ownText, withoutUrls } from './text'

describe('findUrls', () => {
  it('finds links with and without a scheme, without trailing punctuation', () => {
    expect(
      findUrls(
        'live at https://a.vercel.app, code at github.com/ex-a/b. (see https://c.example.com/x)',
      ),
    ).toEqual(['https://a.vercel.app/', 'https://github.com/ex-a/b', 'https://c.example.com/x'])
  })

  it('does not read an email address or a file name as a link', () => {
    expect(findUrls('mail priya@example.com, see README.md and Next.js')).toEqual([])
  })

  it('keeps a query string', () => {
    expect(findUrls('https://docs.google.com/document/d/1x/edit?usp=sharing')).toEqual([
      'https://docs.google.com/document/d/1x/edit?usp=sharing',
    ])
  })
})

describe('linkKind', () => {
  it.each([
    ['https://github.com/ex-a/app', 'repo'],
    ['https://github.com/ex-a', 'other'],
    ['https://docs.google.com/document/d/1x/edit', 'doc'],
    ['https://www.notion.so/ex/Take-home', 'doc'],
    ['https://app.vercel.app', 'submission'],
    ['https://www.loom.com/share/abc', 'submission'],
    ['https://developer.example.com/docs/api', 'other'],
  ])('%s is %s', (url, kind) => {
    expect(linkKind(url, '')).toBe(kind)
  })

  it('a custom domain is a submission only when the sender says it is done or live', () => {
    expect(linkKind('https://pantry.example.dev', 'all done here')).toBe('submission')
    expect(linkKind('https://pantry.example.dev', 'is this ok to use')).toBe('other')
  })
})

describe('ownText', () => {
  it('drops quoted lines and everything after an "On ... wrote:" line', () => {
    const paste = `Here it is: https://a.vercel.app

On Mon, Sep 28, 2026 at 10:02 AM Rae Lin <rae@example.com> wrote:
> Hi Ana, here is the take-home`
    expect(ownText(paste)).toBe('Here it is: https://a.vercel.app')
    expect(findLinks(ownText(paste)).map((l) => l.kind)).toEqual(['submission'])
  })
})

describe('withoutUrls', () => {
  it('removes a "?" that is part of a link', () => {
    expect(withoutUrls('see https://x.example.com/a?b=1').includes('?')).toBe(false)
  })
})
