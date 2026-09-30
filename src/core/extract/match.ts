import { normalizeUrl } from '../links'
import type { Link } from '../types'
import type { KnownCandidate, Match } from './types'

/** Lowercase, no accents, single spaces: "Tomás  Rivera" and "tomas rivera" compare equal. */
export function foldName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function repoOwner(url: string): string | null {
  const u = new URL(url)
  if (!/^(www\.)?(github\.com|gitlab\.com|bitbucket\.org)$/.test(u.hostname)) return null
  const owner = u.pathname.split('/').filter(Boolean)[0]
  return owner ? `${u.hostname.replace(/^www\./, '')}/${owner.toLowerCase()}` : null
}

/** Same last name, and first names that are equal or one is a short form of the other. */
function samePerson(a: string, b: string): boolean {
  const [af = '', ...ar] = foldName(a).split(' ')
  const [bf = '', ...br] = foldName(b).split(' ')
  // A saved one-word name, such as "Kat", has no last name to disagree with.
  if (ar.length > 0 && br.length > 0 && ar.at(-1) !== br.at(-1)) return false
  return (
    af === bf || (Math.min(af.length, bf.length) >= 3 && (af.startsWith(bf) || bf.startsWith(af)))
  )
}

export interface MatchInput {
  name: string | null
  contacts: string[]
  links: Link[]
}

/**
 * The known candidate a paste belongs to.
 * Strong: a shared email, handle, phone, link, repo owner, or the same full name.
 * Weak: only a first name, or a short form of one ("Sam" for "Samantha"), shared by one candidate.
 * Two candidates that fit equally well give no match, so she picks.
 */
export function matchCandidate(input: MatchInput, candidates: KnownCandidate[]): Match | null {
  for (const contact of input.contacts) {
    const hits = candidates.filter((c) => c.contacts.includes(contact))
    if (hits.length === 1 && hits[0]) return { id: hits[0].id, strength: 'strong', via: contact }
  }

  // Only the candidate's own work identifies them. Her take-home doc goes to everyone.
  const urls = input.links
    .filter((l) => l.kind === 'submission' || l.kind === 'repo')
    .map((l) => normalizeUrl(l.url) ?? l.url)
  // A link match gives way when the paste gives a full name that belongs to someone else.
  // "Alex Moreno" still agrees with "Alexandra Moreno".
  const agrees = (c: KnownCandidate) => !input.name?.includes(' ') || samePerson(input.name, c.name)
  for (const url of urls) {
    const hits = candidates.filter((c) => c.links.some((l) => (normalizeUrl(l) ?? l) === url))
    if (hits.length === 1 && hits[0] && agrees(hits[0])) {
      return { id: hits[0].id, strength: 'strong', via: url }
    }
  }
  for (const url of urls) {
    const owner = repoOwner(url)
    if (!owner) continue
    const hits = candidates.filter((c) => c.links.some((l) => repoOwner(l) === owner))
    if (hits.length === 1 && hits[0] && agrees(hits[0])) {
      return { id: hits[0].id, strength: 'strong', via: owner }
    }
  }

  if (!input.name) return null
  const name = foldName(input.name)
  const full = candidates.filter((c) => foldName(c.name) === name)
  if (full.length === 1 && full[0]) return { id: full[0].id, strength: 'strong', via: input.name }
  if (full.length > 1 || name.includes(' ')) return null

  const first = (c: KnownCandidate) => foldName(c.name).split(' ')[0] ?? ''
  const exact = candidates.filter((c) => first(c) === name)
  if (exact.length === 1 && exact[0]) return { id: exact[0].id, strength: 'weak', via: input.name }
  if (exact.length > 1 || name.length < 3) return null
  const short = candidates.filter((c) => first(c).startsWith(name))
  if (short.length === 1 && short[0]) return { id: short[0].id, strength: 'weak', via: input.name }
  return null
}
