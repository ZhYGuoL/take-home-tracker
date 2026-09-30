/**
 * One canonical form per contact, so the same person matches across pastes.
 * Emails and handles are lowercased. A phone keeps only its digits. A ten-digit number
 * without a country code gets +1, the North American code.
 */
export function normalizeContact(raw: string): string {
  const s = raw.trim()
  if (s === '') return ''
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s.toLowerCase()
  if (/^@[A-Za-z0-9_]{1,30}$/.test(s)) return s.toLowerCase()
  const digits = s.replace(/[^\d]/g, '')
  if (/^\+?[\d\s().-]{7,}$/.test(s) && digits.length >= 7) {
    if (digits.length === 10 && !s.startsWith('+')) return `+1${digits}`
    return `+${digits}`
  }
  return s
}

export function parseContacts(raw: string): string[] {
  const out: string[] = []
  for (const part of raw.split(/[,\n]/)) {
    const c = normalizeContact(part)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}
