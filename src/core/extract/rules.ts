import { normalizeContact } from '../contacts'
import type { Source } from '../types'
import { foldName, matchCandidate } from './match'
import { findLinks, lines, ownText, withoutUrls } from './text'
import type { ExtractContext, Proposal } from './types'
import { parseClock, parseDayLine, parseDeadline, parseStamp } from './when'

/** Who sent the message and when, as the copied headers or chat lines show it. */
interface Head {
  sender: string | null
  senderEmail: string | null
  senderPhone: string | null
  handle: string | null
  /** The other side when she is the sender: a "To:" header or Gmail's "to Ivan". */
  recipient: string | null
  recipientEmail: string | null
  stamp: string | null
  source: Source | null
  subject: string
  /** The message text under the headers. */
  body: string
  /** The headers show she sent it, even without knowing who she is. */
  fromSelf: boolean
}

const NAME_WORD = String.raw`[\p{Lu}][\p{L}'’-]*`
const NAME = new RegExp(String.raw`^${NAME_WORD}(?:\s+${NAME_WORD}){0,3}$`, 'u')
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const PHONE = /(?<![\w/])(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g
const PHONE_ONLY = /^(?:\+\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/
/** Pronouns people add after their name, such as "(She/Her)". */
const PRONOUNS = /\s*\((?:she|he|they|ze|xe)\/\w+\)/i

const clean = (name: string) => name.replace(PRONOUNS, '').trim()

function nameAndEmail(value: string): { name: string | null; email: string | null } {
  const angle = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value)
  if (angle) return { name: clean(angle[1] ?? '') || null, email: angle[2]?.trim() ?? null }
  const bare = value.trim()
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(bare)) return { name: null, email: bare }
  return { name: NAME.test(clean(bare)) ? clean(bare) : null, email: null }
}

function head(overrides: Partial<Head>): Head {
  return {
    sender: null,
    senderEmail: null,
    senderPhone: null,
    handle: null,
    recipient: null,
    recipientEmail: null,
    stamp: null,
    source: null,
    subject: '',
    body: '',
    fromSelf: false,
    ...overrides,
  }
}

const HEADER_LINE = /^(From|To|Date|Sent|Subject|Cc):\s*(.*)$/i
const FORWARD_MARK =
  /^(?:-{3,}\s*Forwarded message\s*-{3,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,})$/i

/** "From:", "Sent:", "Date:", "To:", "Subject:" lines, in any order, from Outlook or Apple Mail. */
function emailHeaders(all: string[], start: number, now: string, zone: string): Head | null {
  const h: Record<string, string> = {}
  let i = start
  for (; i < all.length; i++) {
    const m = HEADER_LINE.exec(all[i] ?? '')
    if (!m) break
    h[(m[1] ?? '').toLowerCase()] = m[2] ?? ''
  }
  if (Object.keys(h).length < 2 || !(h.from || h.to)) return null
  const from = h.from ? nameAndEmail(h.from) : { name: null, email: null }
  const to = h.to ? nameAndEmail(h.to) : { name: null, email: null }
  const stampText = h.date ?? h.sent ?? ''
  return head({
    sender: from.name,
    senderEmail: from.email,
    recipient: to.name,
    recipientEmail: to.email,
    stamp: stampText ? parseStamp(stampText, now, zone) : null,
    source: 'email',
    subject: h.subject ?? '',
    body: all.slice(i).join('\n'),
  })
}

/**
 * Gmail on the web: optional subject and label lines, then "Name <email>", then a time such as
 * "Fri, Oct 2, 9:14 AM (3 days ago)", then "to me" or "to Ivan".
 */
function gmailWeb(all: string[], now: string, zone: string): Head | null {
  for (let i = 0; i < Math.min(all.length, 8); i++) {
    const m = /^(.+?)\s*<([^>\s]+@[^>\s]+)>$/.exec(all[i] ?? '')
    if (!m) continue
    const when = all[i + 1] ?? ''
    const toLine = all.slice(i + 1, i + 4).find((l) => /^to\s+\S/i.test(l))
    if (!toLine && !/\(\d+ \w+ ago\)/.test(when)) continue
    const toIdx = toLine ? all.indexOf(toLine, i + 1) : i + 1
    const to = toLine?.replace(/^to\s+/i, '').trim() ?? ''
    const toEmail = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(to) ? to : null
    return head({
      sender: clean(m[1] ?? '') || null,
      senderEmail: m[2] ?? null,
      // Gmail shows "to me" on mail she got, and the other person on mail she sent.
      fromSelf: Boolean(to) && !/^me\b/i.test(to),
      recipient: to && !toEmail && to.toLowerCase() !== 'me' ? to : null,
      recipientEmail: toEmail,
      stamp: parseStamp(when, now, zone) ?? parseClock(when, now, zone),
      source: 'email',
      subject: all.slice(0, i).find((l) => l && !/^(inbox|important|starred)$/i.test(l)) ?? '',
      body: all.slice(toIdx + 1).join('\n'),
    })
  }
  return null
}

/** LinkedIn: "Oct 28" or "Today", then "Name sent the following message at 6:41 PM". */
function linkedin(all: string[], now: string, zone: string): Head | null {
  const idx = all.findIndex((l) => /\bsent the following messages? at\b/i.test(l))
  if (idx < 0 || idx > 3) return null
  const m = /^(.+?) sent the following messages? at (.+)$/i.exec(all[idx] ?? '')
  const name = clean(m?.[1] ?? '') || null
  const day = all
    .slice(0, idx)
    .map((l) => parseDayLine(l, now, zone))
    .find(Boolean)
  const rest = all.slice(idx + 1).filter((l) => {
    if (/^View .+ profile$/i.test(l)) return false
    if (name && clean(l).startsWith(name) && clean(l).length <= name.length + 12) return false
    return true
  })
  return head({
    sender: name,
    stamp: parseClock(` ${m?.[2] ?? ''} `, now, zone, day ?? undefined),
    source: 'linkedin',
    body: rest.join('\n'),
  })
}

/**
 * Chat apps: "[9/30/26, 11:16 AM] Lena Fischer: text" (WhatsApp), "[10:42 AM] Name: text",
 * "Name, [Nov 3, 2026 at 9:15 AM]:" (Telegram), "Name  1:58 PM" (Slack), and
 * "Name - Today at 9:15 AM" (Discord).
 */
function chat(all: string[], now: string, zone: string): Head | null {
  const bracket = /^\[([^\]]+)\]\s*([^:]{2,60}):\s*(.*)$/
  const first = all.findIndex(Boolean)
  const line = all[first] ?? ''
  const b = bracket.exec(line)
  if (b) {
    const who = b[2]?.trim() ?? ''
    const own = all.filter((l) => {
      const x = bracket.exec(l)
      return !x || x[2]?.trim() === who
    })
    const phone = PHONE_ONLY.test(who) ? who : null
    return head({
      sender: phone ? null : who,
      senderPhone: phone,
      stamp: parseStamp(b[1] ?? '', now, zone) ?? parseClock(b[1] ?? '', now, zone),
      source: 'other',
      body: own.map((l) => bracket.exec(l)?.[3] ?? l).join('\n'),
    })
  }
  const telegram = /^(.+?),\s*\[([^\]]+)\]:?$/.exec(line)
  if (telegram && NAME.test(clean(telegram[1] ?? ''))) {
    return head({
      sender: clean(telegram[1] ?? ''),
      stamp: parseStamp(telegram[2] ?? '', now, zone),
      source: 'other',
      body: all.slice(first + 1).join('\n'),
    })
  }
  const discord =
    /^(.+?)\s+[-–]\s+((?:today|yesterday)\s+at\s+.+|\d{1,2}\/\d{1,2}\/\d{2,4}.*)$/i.exec(line)
  if (discord && NAME.test(clean(discord[1] ?? ''))) {
    return head({
      sender: clean(discord[1] ?? ''),
      stamp: parseStamp(discord[2] ?? '', now, zone),
      source: 'other',
      body: all.slice(first + 1).join('\n'),
    })
  }
  const slack = /^(.+?)\s{2,}(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*$/i.exec(line)
  if (slack && NAME.test(clean(slack[1] ?? ''))) {
    return head({
      sender: clean(slack[1] ?? ''),
      stamp: parseClock(` ${slack[2] ?? ''} `, now, zone),
      source: 'other',
      body: all.slice(first + 1).join('\n'),
    })
  }
  return nameThenTime(all, first, now, zone)
}

/** Words that make a first line a subject, not a person. */
const SUBJECT_WORDS = new Set(
  'take home take-home submission assignment question update project task exercise challenge interview re fwd'.split(
    ' ',
  ),
)

/**
 * A name on the first line and only a time on the next, as Messages and other apps copy a
 * message: "Priya Raman", then "Today 9:14 AM" or "Fri, Sep 25, 9:14 AM".
 */
function nameThenTime(all: string[], first: number, now: string, zone: string): Head | null {
  const who = clean(all[first] ?? '')
  const when = (all[first + 1] ?? '').trim()
  const words = who.toLowerCase().split(/\s+/)
  if (!NAME.test(who) || words.some((w) => NOT_NAMES.has(w) || SUBJECT_WORDS.has(w))) return null
  // A short line that is only a date and a time, not a sentence that mentions one.
  if (when.length > 32 || /[?!.]$/.test(when) || when.split(/\s+/).length > 6) return null
  const stamp = /^\d{1,2}:\d{2}\s*([AP]M)?$/i.test(when)
    ? parseClock(` ${when} `, now, zone)
    : parseStamp(when, now, zone)
  if (!stamp) return null
  return head({ sender: who, stamp, body: all.slice(first + 2).join('\n') })
}

/**
 * X copies a DM thread as the other person's name and @handle, sometimes with their bio and a
 * "Joined ... · N Followers" line, then the messages, then a time such as "Oct 15, 8:03 PM".
 */
function xDm(all: string[], now: string, zone: string): Head | null {
  const nonEmpty = all.filter(Boolean)
  const oneLine = /^(.+?)\s+(@\w{1,30})\s*·\s*(.+)$/.exec(nonEmpty[0] ?? '')
  if (oneLine && NAME.test(oneLine[1] ?? '')) {
    return head({
      sender: oneLine[1] ?? null,
      handle: oneLine[2] ?? null,
      stamp: parseClock(` ${oneLine[3] ?? ''} `, now, zone),
      source: 'x',
      body: nonEmpty.slice(1).join('\n'),
    })
  }
  if (!NAME.test(nonEmpty[0] ?? '') || !/^@\w{1,30}$/.test(nonEmpty[1] ?? '')) return null
  let body = nonEmpty.slice(2)
  const joined = body.findIndex((l) => /^Joined .+·.+Followers?$/i.test(l))
  if (joined >= 0 && joined < 4) body = body.slice(joined + 1)
  const last = body.at(-1) ?? ''
  let stamp: string | null = null
  if (last.length < 32 && /\d/.test(last)) {
    stamp = parseStamp(last, now, zone) ?? parseClock(last, now, zone)
    if (stamp || /^[A-Z][a-z]{2} \d{1,2}(?:, \d{4})?$/.test(last)) body = body.slice(0, -1)
  }
  // The name on top is the other person in the thread, whichever side wrote the message.
  return head({
    sender: nonEmpty[0] ?? null,
    recipient: nonEmpty[0] ?? null,
    handle: nonEmpty[1] ?? null,
    stamp,
    source: 'x',
    body: body.join('\n'),
  })
}

/**
 * Reads the headers of the message she copied. When the paste starts with someone's note and
 * then a forwarded message, the forwarded message is the candidate's.
 */
function readHead(paste: string, now: string, zone: string): Head {
  const text = paste.replace(/\r\n?/g, '\n').trim()
  const all = lines(text)
  const headerAt = all.findIndex((l) => HEADER_LINE.test(l))
  const fwdAt = all.findIndex((l) => FORWARD_MARK.test(l))
  if (headerAt >= 0 && headerAt <= 3) {
    const h = emailHeaders(all, headerAt, now, zone)
    if (h) return h
  }
  const top =
    gmailWeb(all, now, zone) ??
    linkedin(all, now, zone) ??
    chat(all, now, zone) ??
    xDm(all, now, zone)
  if (top) {
    // A forwarded message under a copied header is part of this message, such as a nudge.
    return top
  }
  if (fwdAt >= 0) {
    const inner = all.slice(fwdAt + 1)
    const at = inner.findIndex((l) => HEADER_LINE.test(l))
    const h = at >= 0 && at <= 3 ? emailHeaders(inner, at, now, zone) : null
    if (h) return h
  }
  const quoteOn = /^On .{6,160} wrote:\s*$/
  const looksLikeMail =
    all.some((l) => quoteOn.test(l) && /@/.test(l)) || /^Sent from my \w+/im.test(text)
  return head({ source: looksLikeMail ? 'email' : null, body: text })
}

const NOT_NAMES = new Set(
  'there team all everyone folks guys you me it this that done live ready here finished ok okay fine working sorry thanks hi hey hello morning'.split(
    ' ',
  ),
)

const titleCase = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

function isSelf(name: string, ctx: ExtractContext): boolean {
  const self = ctx.self?.name ? foldName(ctx.self.name) : null
  if (!self) return false
  const n = foldName(name)
  return n === self || n === self.split(' ')[0]
}

const isSelfEmail = (email: string | null, ctx: ExtractContext) =>
  Boolean(email && ctx.self?.email && email.toLowerCase() === ctx.self.email.toLowerCase())

/** A line that is part of a signature, not a name: a phone, an email, a link, or a title. */
const SIGNATURE_DETAIL =
  /^(?:[+(\d][\d\s().+-]{6,}|\S+@\S+|\S+\.\S+\/\S*|.*\|.*|sent from my .+|--)$/i

/** A name the sender gives: a signature, a sign-off, or "this is Kofi Mensah". */
function senderName(body: string, ctx: ExtractContext): string | null {
  const all = lines(body)
  const closing =
    /^(thanks|thank you|thanks so much|many thanks|best|best regards|regards|cheers|sincerely|warmly|all the best|talk soon|kind regards|thx)[\s,!.]*$/i
  for (let i = all.length - 1; i >= 0; i--) {
    if (!closing.test(all[i] ?? '')) continue
    const next = all.slice(i + 1).find(Boolean)
    if (next && NAME.test(clean(next)) && !isSelf(next, ctx)) return clean(next)
  }
  // A signature block: the last name-like line followed only by phones, emails, links, or titles.
  const lastText = all.findLastIndex((l) => l && !SIGNATURE_DETAIL.test(l))
  for (let i = lastText; i >= Math.max(0, lastText - 1); i--) {
    const line = clean(all[i] ?? '')
    if (i > 0 && all[i - 1] === '' && NAME.test(line) && !isSelf(line, ctx)) {
      // A fuller name in a "--" signature below wins over a first name above it.
      const fuller = all.slice(i + 1).find((l) => NAME.test(clean(l)) && clean(l).startsWith(line))
      return fuller ? clean(fuller) : line
    }
  }

  const signOff = new RegExp(
    String.raw`(?:^|\s)[-–—]\s*(${NAME_WORD}(?:\s+${NAME_WORD})?|[a-z]{2,20}(?:\s+[a-z]{2,20})?)\s*$`,
    'u',
  ).exec(body.trim())
  if (signOff?.[1] && !isSelf(signOff[1], ctx) && !NOT_NAMES.has(signOff[1].toLowerCase())) {
    return titleCase(signOff[1])
  }

  const intro = new RegExp(
    String.raw`\b(?:this is|my name is|i'm|i am|it's|it is)\s+(${NAME_WORD}(?:\s+${NAME_WORD})?)`,
    'u',
  ).exec(body)
  if (intro?.[1] && !isSelf(intro[1], ctx) && !NOT_NAMES.has(intro[1].toLowerCase())) {
    return intro[1]
  }
  const here = new RegExp(String.raw`\b(${NAME_WORD}(?:\s+${NAME_WORD})?)\s+here\b`, 'u').exec(body)
  if (
    here?.[1] &&
    !isSelf(here[1], ctx) &&
    !NOT_NAMES.has(here[1].split(' ')[0]?.toLowerCase() ?? '')
  ) {
    return here[1]
  }
  const casual =
    /^\W*(?:hey|hi|yo|hello)?[\s,!]*(?:this is|it's|it is)\s+([a-z]{2,20})\b(?=\s*[-,–—!]|\s+here\b|\s+from\b)/i.exec(
      body,
    )
  if (casual?.[1] && !NOT_NAMES.has(casual[1].toLowerCase())) return titleCase(casual[1])
  return null
}

/** The name she greets in her own message: "Hi Nadia," or "Hey Sam!". */
function greetedName(body: string, ctx: ExtractContext): string | null {
  const m = new RegExp(
    String.raw`^\W*(?:hi|hey|hello|dear|morning|afternoon|hiya)\s+(${NAME_WORD})\b`,
    'iu',
  ).exec(body.trim())
  const name = m?.[1]
  if (!name || NOT_NAMES.has(name.toLowerCase()) || isSelf(name, ctx)) return null
  return name
}

const OUTBOUND = [
  /\bhere(?:'s| is)\s+(?:the|your)\s+(?:\S+\s+){0,4}take[- ]?home\b/i,
  /\btake[- ]?home\s+(?:is here|assignment:)/i,
  /\bsending (?:over |you )?(?:the|your)\s+(?:\S+\s+){0,4}take[- ]?home\b/i,
  /\byou(?:'ll| will)?\s+have\s+(?:\d+|a|one|two|three)\s+(?:hours?|days?|weeks?)\b/i,
  /\bplease submit\b/i,
  /\bjust checking in\b/i,
  /\breply here with\b/i,
  /\byour (?:new )?deadline\b/i,
  /\bmove your deadline\b/i,
  /\bloved your take[- ]?home\b/i,
]

function isOutbound(h: Head, own: string, ctx: ExtractContext): boolean {
  if (h.fromSelf || isSelfEmail(h.senderEmail, ctx)) return true
  if (h.sender && isSelf(h.sender, ctx)) return true
  if (h.source === 'email' && (h.sender || h.senderEmail)) return false
  // She introduces herself: "It's Jo from Acme".
  const intro = new RegExp(String.raw`\b(?:it's|this is|i'm)\s+(${NAME_WORD})\b`, 'u').exec(own)
  if (intro?.[1] && isSelf(intro[1], ctx)) return true
  if (OUTBOUND.some((re) => re.test(own))) return true
  const greeted = greetedName(own, ctx)
  if (!greeted) return false
  // In a chat thread copied with the other person's name on top, greeting that name means she wrote it.
  if (h.sender && foldName(h.sender).split(' ')[0] === foldName(greeted)) return true
  return ctx.candidates.some((c) => foldName(c.name).split(' ')[0] === foldName(greeted))
}

const ASKS = [
  /\bwould it be possible\b/i,
  /\bany chance\b/i,
  /\bis (?:it|that|this) (?:ok|okay|fine|alright)\b/i,
  /\b(?:ok|okay|alright) if\b/i,
  /\b(?:can|could|should|may) i\b/i,
  /\bdo you (?:want|prefer|need|mind)\b/i,
  /\bwondering (?:whether|if)\b/i,
  /\bdo you know\b/i,
  /\bworks? for (?:me|the|a|our)\b/i,
  /\bwould .{1,40} work\b/i,
  /\b(?:don't|do not|doesn't|can't|cannot) (?:have )?access\b/i,
  /\b(?:i'm|i am) (?:stuck|blocked)\b/i,
  /\bplease (?:let me know|advise|confirm)\b/i,
]

/** An inbound message needs a reply when it asks something or waits on her (D7). */
export function asksSomething(own: string): boolean {
  const text = withoutUrls(own)
  return text.includes('?') || ASKS.some((re) => re.test(text))
}

const ROLE =
  /\b(?:(founding|senior|staff|lead|principal|junior|sr\.?)\s+)?(?:(full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|product|software|platform|infrastructure|infra|ml|ai|data|mobile|ios|android|design|devops|security|qa|solutions|forward[- ]deployed)\s+)?engineer(?:ing)?\b/i

const ACRONYMS: Record<string, string> = {
  ml: 'ML',
  ai: 'AI',
  ios: 'iOS',
  qa: 'QA',
  devops: 'DevOps',
}

export function roleIn(text: string, known: string[]): string | null {
  const m = ROLE.exec(text)
  if (!m || (!m[1] && !m[2])) return null
  const words = [m[1], m[2], 'engineer']
    .filter(Boolean)
    .map((w) => w?.toLowerCase().replace(/^sr\.?$/, 'senior') ?? '')
  const role = words
    .map((w, i) => ACRONYMS[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
  return known.find((k) => k.toLowerCase() === role.toLowerCase()) ?? role
}

function contactsIn(h: Head, own: string, outbound: boolean, ctx: ExtractContext): string[] {
  const found: Array<string | null> = outbound
    ? [h.recipientEmail, h.source === 'x' ? h.handle : null]
    : [h.senderEmail, h.senderPhone, h.handle]
  // In her own message, the body signature is hers, so only the recipient counts.
  if (!outbound) {
    for (const m of own.matchAll(EMAIL)) found.push(m[0])
    for (const m of own.matchAll(PHONE)) found.push(m[0])
  }
  const out: string[] = []
  for (const raw of found) {
    if (!raw || isSelfEmail(raw, ctx)) continue
    const c = normalizeContact(raw)
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}

/** Reads a paste with rules only: no network, no model. */
export function extractWithRules(paste: string, ctx: ExtractContext): Proposal {
  const h = readHead(paste, ctx.now, ctx.zone)
  const own = ownText(h.body)
  const outbound = isOutbound(h, own, ctx)
  const links = findLinks(ownText(paste.replace(/^.*\((?:\d+ \w+ ago)\).*$/gm, '')))
  const contacts = contactsIn(h, own, outbound, ctx)
  const name = outbound
    ? (h.recipient ??
      greetedName(own, ctx) ??
      (h.sender && !h.fromSelf && !isSelf(h.sender, ctx) ? h.sender : null))
    : h.sender && !isSelf(h.sender, ctx)
      ? h.sender
      : senderName(own, ctx)
  const known = [...new Set(ctx.candidates.map((c) => c.role).filter(Boolean))]
  return {
    name,
    contacts,
    role: roleIn(`${h.subject}\n${own}`, known),
    source: h.source,
    direction: outbound ? 'out' : 'in',
    messageAt: h.stamp,
    links,
    // "48 hours" counts from when she sent the message, which can be before the paste.
    deadline: outbound ? parseDeadline(own, h.stamp ?? ctx.now, ctx.zone) : null,
    needsReply: !outbound && asksSomething(own),
    match: matchCandidate({ name, contacts, links }, ctx.candidates),
  }
}
