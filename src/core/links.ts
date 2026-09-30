/** Adds https:// when the scheme is missing. Returns null when the text is not a web address. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  if (s === '') return null
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

/** A short label for a link: host and path, without the scheme or a trailing slash. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
    return `${u.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return url
  }
}
