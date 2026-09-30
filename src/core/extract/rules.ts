import { normalizeContact } from '../contacts'
import type { Link, Source } from '../types'
import { foldName, matchCandidate } from './match'
import { findLinks, lines, ownText, withoutUrls } from './text'
import type { ExtractContext, Proposal } from './types'
import { parseClock, parseDeadline, parseStamp } from './when'

interface Shape {
  name: string | null
  email: string | null
  handle: string | null
  /** An email address the message went to, when she is the sender. */
  toEmail: string | null
  stamp: string | null
  source: Source | null
  subject: string
  /** The words of the message, without headers. */
  body: string
  /** A header says she sent it. */
  outbound: boolean
}

const NAME_WORD = String.raw`[\p{Lu}][\p{L}'’-]*`
const NAME = new RegExp(String.raw`^${NAME_WORD}(?:\s+${NAME_WORD}){0,3}$`, 'u')
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const PHONE = /(?<![\w/])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g

function nameAndEmail(value: string): { name: string | null; email: string | null } {
  const angle = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value)
  if (angle)
    return { name: angle[1]?.trim() || null, email: angle[2]?.trim().toLowerCase() ?? null }
  const bare = value.trim()
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(bare)) return { name: null, email: bare.toLowerCase() }
  return { name: NAME.test(bare) ? bare : null, email: null }
}

function emailShape(text: string, zone: string): Shape | null {
  const all = lines(text)
  const start = all.findIndex((l) => /^(From|To|Date|Sent|Subject|Cc):/i.test(l))
  if (start < 0 || start > 3) return null
  const headers: Record<string, string> = {}
  let i = start
  for (; i < all.length; i++) {
    const m = /^(From|To|Date|Sent|Subject|Cc):\s*(.*)$/i.exec(all[i] ?? '')
    if (!m) break
    headers[(m[1] ?? '').toLowerCase()] = m[2] ?? ''
  }
  if (Object.keys(headers).length < 2) return null
  const from = headers.from ? nameAndEmail(headers.from) : { name: null, email: null }
  const to = headers.to ? nameAndEmail(headers.to) : { name: null, email: null }
  const outbound = !headers.from && Boolean(headers.to)
  const stampText = headers.date ?? headers.sent ?? ''
  return {
    name: outbound ? null : from.name,
    email: outbound ? null : from.email,
    handle: null,
    toEmail: outbound ? to.email : null,
    stamp: stampText ? parseStamp(stampText, zone) : null,
    source: 'email',
    subject: headers.subject ?? '',
    body: all.slice(i).join('\n'),
    outbound,
  }
}

/** Gmail on the web copies as "Name <email>", then "3:22 PM (8 minutes ago)", then "to me". */
function gmailShape(text: string, now: string, zone: string): Shape | null {
  const all = lines(text)
  const head = /^(.+?)\s*<([^>\s]+@[^>\s]+)>$/.exec(all[0] ?? '')
  if (!head || !/\(\d+ \w+ ago\)|^to me$/i.test(all.slice(1, 3).join('\n'))) return null
  const bodyStart = all.findIndex((l, i) => i > 0 && /^to\b/i.test(l)) + 1
  return {
    name: head[1]?.trim() ?? null,
    email: head[2]?.toLowerCase() ?? null,
    handle: null,
    toEmail: null,
    stamp: parseStamp(all[1] ?? '', zone) ?? parseClock(all[1] ?? '', now, zone),
    source: 'email',
    subject: '',
    body: all.slice(bodyStart > 0 ? bodyStart : 2).join('\n'),
    outbound: false,
  }
}

function linkedinShape(text: string, now: string, zone: string): Shape | null {
  const all = lines(text)
  const m = /^(.+?) sent the following messages? at (.+)$/i.exec(all[0] ?? '')
  if (!m) return null
  const name = m[1]?.trim() ?? null
  const rest = all.slice(1)
  if (name && rest[0]?.startsWith(name)) rest.shift()
  return {
    name,
    email: null,
    handle: null,
    toEmail: null,
    stamp: parseClock(` ${m[2] ?? ''} `, now, zone),
    source: 'linkedin',
    subject: '',
    body: rest.join('\n'),
    outbound: false,
  }
}

/** "[9/30/26, 11:16 AM] Lena Fischer: finished!", one line per message. */
function chatShape(text: string, zone: string): Shape | null {
  const all = lines(text).filter(Boolean)
  const re = /^\[([^\]]+)\]\s*([^:]{2,60}):\s*(.*)$/
  const first = re.exec(all[0] ?? '')
  if (!first || !all.every((l) => re.test(l))) return null
  const name = first[2]?.trim() ?? null
  return {
    name,
    email: null,
    handle: null,
    toEmail: null,
    stamp: parseStamp(first[1] ?? '', zone),
    source: null,
    subject: '',
    body: all.map((l) => re.exec(l)?.[3] ?? '').join('\n'),
    outbound: false,
  }
}

/** X copies a DM as the name, then the @handle, or both on one line with "· 9:12 AM". */
function xShape(text: string, now: string, zone: string): Shape | null {
  const all = lines(text).filter(Boolean)
  const oneLine = /^(.+?)\s+(@\w{1,30})\s*·\s*(.+)$/.exec(all[0] ?? '')
  if (oneLine && NAME.test(oneLine[1] ?? '')) {
    return {
      name: oneLine[1] ?? null,
      email: null,
      handle: oneLine[2] ?? null,
      toEmail: null,
      stamp: parseClock(` ${oneLine[3] ?? ''} `, now, zone),
      source: 'x',
      subject: '',
      body: all.slice(1).join('\n'),
      outbound: false,
    }
  }
  if (!NAME.test(all[0] ?? '') || !/^@\w{1,30}$/.test(all[1] ?? '')) return null
  const body = all.slice(2)
  const last = body.at(-1) ?? ''
  let stamp: string | null = null
  if (/^\d{1,2}:\d{2}\s*[ap]\.?m\.?$/i.test(last)) {
    stamp = parseClock(` ${last} `, now, zone)
    body.pop()
  } else if (/^[A-Z][a-z]{2} \d{1,2}$/.test(last)) {
    body.pop()
  }
  return {
    name: all[0] ?? null,
    email: null,
    handle: all[1] ?? null,
    toEmail: null,
    stamp,
    source: 'x',
    subject: '',
    body: body.join('\n'),
    outbound: false,
  }
}

function plainShape(text: string): Shape {
  return {
    name: null,
    email: null,
    handle: null,
    toEmail: null,
    stamp: null,
    source: null,
    subject: '',
    body: text,
    outbound: false,
  }
}

function shapeOf(paste: string, now: string, zone: string): Shape {
  const text = paste.replace(/\r\n?/g, '\n').trim()
  const fwd = text.search(/^-{3,}\s*Forwarded message\s*-{3,}$/im)
  const email = fwd >= 0 ? text.slice(text.indexOf('\n', fwd) + 1) : text
  return (
    emailShape(email, zone) ??
    gmailShape(text, now, zone) ??
    linkedinShape(text, now, zone) ??
    chatShape(text, zone) ??
    xShape(text, now, zone) ??
    plainShape(text)
  )
}

const NOT_NAMES = new Set(
  'there team all everyone folks guys you me it this that done live ready here finished ok okay fine working sorry thanks'.split(
    ' ',
  ),
)

const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1)

function isSelf(name: string, ctx: ExtractContext): boolean {
  const self = ctx.self?.name ? foldName(ctx.self.name) : null
  if (!self) return false
  const n = foldName(name)
  return n === self || n === self.split(' ')[0]
}

/** A name the sender gives: a signature, a sign-off, or "this is Kofi Mensah". */
function senderName(body: string, ctx: ExtractContext): string | null {
  const all = lines(body)
  const closing =
    /^(thanks|thank you|thanks so much|many thanks|best|best regards|regards|cheers|sincerely|warmly|all the best|talk soon)[\s,!.]*$/i
  for (let i = all.length - 1; i >= 0; i--) {
    if (!closing.test(all[i] ?? '')) continue
    const next = all.slice(i + 1).find(Boolean)
    if (next && NAME.test(next) && !isSelf(next, ctx)) return next
  }
  const lastIdx = all.findLastIndex(Boolean)
  const last = all[lastIdx] ?? ''
  if (lastIdx > 0 && all[lastIdx - 1] === '' && NAME.test(last) && !isSelf(last, ctx)) return last

  const signOff = new RegExp(
    String.raw`\s[-–—]\s*(${NAME_WORD}(?:\s+${NAME_WORD})?)\s*$`,
    'u',
  ).exec(body.trim())
  if (signOff?.[1] && !isSelf(signOff[1], ctx)) return signOff[1]

  const intro = new RegExp(
    String.raw`\b(?:this is|my name is|i'm|i am|it's|it is)\s+(${NAME_WORD}(?:\s+${NAME_WORD})?)`,
    'u',
  ).exec(body)
  if (intro?.[1] && !isSelf(intro[1], ctx) && !NOT_NAMES.has(intro[1].toLowerCase()))
    return intro[1]

  const casual =
    /^\W*(?:hey|hi|yo|hello)?[\s,!]*(?:this is|it's|it is)\s+([a-z]{2,20})\b(?=\s*[-,–—]|\s+here\b|\s+from\b)/i.exec(
      body,
    )
  if (casual?.[1] && !NOT_NAMES.has(casual[1].toLowerCase())) return titleCase(casual[1])
  return null
}

/** The name she greets in her own message: "Hi Nadia," or "Hey Sam!". */
function greetedName(body: string, ctx: ExtractContext): string | null {
  const m = new RegExp(
    String.raw`^\W*(?:hi|hey|hello|dear|morning|afternoon)\s+(${NAME_WORD})\b`,
    'iu',
  ).exec(body.trim())
  const name = m?.[1]
  if (!name || NOT_NAMES.has(name.toLowerCase()) || isSelf(name, ctx)) return null
  return name
}

const OUTBOUND = [
  /\bhere(?:'s| is)\s+(?:the|your)\s+take[- ]?home\b/i,
  /\btake[- ]?home\s+(?:is here|assignment:)/i,
  /\byou(?:'ll| will)?\s+have\s+(?:\d+|a|one|two|three)\s+(?:hours?|days?|weeks?)\b/i,
  /\bplease submit\b/i,
  /\bjust checking in\b/i,
  /\breply here with\b/i,
]

function isOutbound(shape: Shape, own: string, ctx: ExtractContext): boolean {
  if (shape.outbound) return true
  if (shape.name && !isSelf(shape.name, ctx)) return false
  if (OUTBOUND.some((re) => re.test(own))) return true
  const greeted = greetedName(own, ctx)
  return Boolean(
    greeted && ctx.candidates.some((c) => foldName(c.name).split(' ')[0] === foldName(greeted)),
  )
}

const ASKS = [
  /\bwould it be possible\b/i,
  /\bany chance\b/i,
  /\bis (?:it|that|this) (?:ok|okay|fine|alright)\b/i,
  /\b(?:can|could|should|may) i\b/i,
  /\bwondering (?:whether|if)\b/i,
  /\bdo you know\b/i,
  /\bworks? for (?:me|the|a|our)\b/i,
  /\bwould .{1,40} work\b/i,
]

/** An inbound message needs a reply when it asks something (D7). */
export function asksSomething(own: string): boolean {
  const text = withoutUrls(own)
  return text.includes('?') || ASKS.some((re) => re.test(text))
}

const ROLE =
  /\b(?:(founding|senior|staff|lead|principal|junior)\s+)?(?:(full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|product|software|platform|infrastructure|infra|ml|ai|data|mobile|ios|android)\s+)?engineer(?:ing)?\b/i

export function roleIn(text: string, known: string[]): string | null {
  const m = ROLE.exec(text)
  if (!m || (!m[1] && !m[2])) return null
  const words = [m[1], m[2], 'engineer'].filter(Boolean).join(' ').toLowerCase()
  const role = words.charAt(0).toUpperCase() + words.slice(1)
  return known.find((k) => k.toLowerCase() === role.toLowerCase()) ?? role
}

function contactsIn(shape: Shape, own: string, ctx: ExtractContext): string[] {
  const self = ctx.self?.email?.toLowerCase()
  const found = [shape.email, shape.handle, shape.toEmail]
  for (const m of own.matchAll(EMAIL)) found.push(m[0])
  for (const m of own.matchAll(PHONE)) found.push(m[0])
  const out: string[] = []
  for (const raw of found) {
    if (!raw) continue
    const c = normalizeContact(raw)
    if (c && c !== self && !out.includes(c)) out.push(c)
  }
  return out
}

/** Reads a paste with rules only: no network, no model. */
export function extractWithRules(paste: string, ctx: ExtractContext): Proposal {
  const shape = shapeOf(paste, ctx.now, ctx.zone)
  const own = ownText(shape.body)
  const outbound = isOutbound(shape, own, ctx)
  const links: Link[] = findLinks(own)
  const contacts = contactsIn(shape, own, ctx)
  const name = outbound
    ? greetedName(own, ctx)
    : shape.name && !isSelf(shape.name, ctx)
      ? shape.name
      : senderName(own, ctx)
  const known = [...new Set(ctx.candidates.map((c) => c.role).filter(Boolean))]
  return {
    name,
    contacts,
    role: roleIn(`${shape.subject}\n${own}`, known),
    source: shape.source,
    direction: outbound ? 'out' : 'in',
    messageAt: shape.stamp,
    links,
    deadline: outbound ? parseDeadline(own, ctx.now, ctx.zone) : null,
    needsReply: !outbound && asksSomething(own),
    match: matchCandidate({ name, contacts, links }, ctx.candidates),
  }
}
