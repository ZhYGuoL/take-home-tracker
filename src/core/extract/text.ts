import { normalizeUrl } from '../links'
import type { Link, LinkKind } from '../types'

/**
 * The part of a paste that the sender wrote: quoted lines (">") and everything after an
 * "On ... wrote:" line are someone else's words, usually hers.
 */
export function ownText(paste: string): string {
  const out: string[] = []
  const all = paste.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < all.length; i++) {
    const line = (all[i] ?? '').trim()
    const next = (all[i + 1] ?? '').trim()
    if (/^On .{6,160} wrote:$/.test(line)) break
    // Gmail can wrap "On ... wrote:" over two lines.
    if (/^On .{6,120}$/.test(line) && /wrote:$/.test(next)) break
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line)) break
    if (/^_{10,}$/.test(line)) break
    // Outlook quotes an earlier message under its own "From:" and "Sent:" lines. A forwarded
    // message also has "From:" lines, but it is the content, so it stays.
    const before =
      out
        .filter((l) => l.trim())
        .at(-1)
        ?.trim() ?? ''
    const forwarded = /forwarded message|^begin forwarded/i.test(before)
    if (before && !forwarded && /^From:\s.+/.test(line) && /^Sent:/.test(next)) break
    if (line.startsWith('>')) continue
    out.push(all[i] ?? '')
  }
  return out.join('\n').trim()
}

// A web address with a scheme, or a bare host with a common suffix, such as github.com/x/y.
const URL_RE =
  /(?<![@\w.-])(?:https?:\/\/[^\s<>"'`]+|(?:[a-z0-9-]+\.)+(?:com|dev|io|app|net|org|co|ai|so|sh|me|site|page|xyz|tech|ly)(?:\/[^\s<>"'`]*)?)/gi

export function findUrls(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(URL_RE)) {
    // The part of an email address before the "@" is not a link.
    if (text[(m.index ?? 0) + m[0].length] === '@') continue
    const raw = m[0].replace(/[.,;:!?)\]}'"]+$/, '')
    // A closing parenthesis inside the link stays when the link opened one.
    const balanced = raw.includes('(') && m[0].endsWith(')') ? `${raw})` : raw
    const url = normalizeUrl(balanced)
    if (url && !out.includes(url)) out.push(url)
  }
  return out
}

/** Text with every web address removed, so a "?" in a query string is not a question. */
export function withoutUrls(text: string): string {
  return text.replace(URL_RE, ' ')
}

const REPO_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org']
const DOC_HOSTS = ['docs.google.com', 'notion.so', 'notion.site', 'coda.io']
/** Profiles, designs, and scheduling pages: never the work itself. */
const OTHER_HOSTS = [
  'linkedin.com',
  'figma.com',
  'calendly.com',
  'cal.com',
  'x.com',
  'twitter.com',
  'zoom.us',
  'meet.google.com',
]
const DEPLOY_SUFFIXES = [
  'vercel.app',
  'netlify.app',
  'pages.dev',
  'workers.dev',
  'fly.dev',
  'onrender.com',
  'herokuapp.com',
  'railway.app',
  'github.io',
  'replit.app',
  'repl.co',
  'surge.sh',
  'web.app',
  'firebaseapp.com',
  'deno.dev',
  'glitch.me',
  'streamlit.app',
]
const VIDEO_HOSTS = ['loom.com', 'youtu.be', 'youtube.com', 'vimeo.com']

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const isOn = (host: string, suffix: string) => host === suffix || host.endsWith(`.${suffix}`)

/**
 * What a link is. A link on a known host decides by host. A link on any other host is a
 * submission when the sender says it is done or live, and "other" otherwise.
 */
export function linkKind(url: string, context: string): LinkKind {
  const host = hostOf(url)
  const path = new URL(url).pathname.split('/').filter(Boolean)
  if (REPO_HOSTS.some((h) => isOn(host, h))) return path.length >= 2 ? 'repo' : 'other'
  if (OTHER_HOSTS.some((h) => isOn(host, h))) return 'other'
  if (DOC_HOSTS.some((h) => isOn(host, h))) return 'doc'
  // A Drive file is a recorded demo when the sender says so, and the take-home document otherwise.
  if (isOn(host, 'drive.google.com')) {
    return /\b(walkthrough|video|demo|recording|recorded|screencast)\b/i.test(context)
      ? 'submission'
      : 'doc'
  }
  if (DEPLOY_SUFFIXES.some((s) => isOn(host, s))) return 'submission'
  if (VIDEO_HOSTS.some((h) => isOn(host, h))) return 'submission'
  if (/^(docs|developer|developers|api)\./.test(host) || path[0] === 'docs') return 'other'
  return /\b(done|live|deployed|submission|submitted|finished|shipped|here it is|built)\b/i.test(
    context,
  )
    ? 'submission'
    : 'other'
}

export function findLinks(text: string): Link[] {
  return findUrls(text).map((url) => ({ url, kind: linkKind(url, text) }))
}

export function lines(text: string): string[] {
  return text.split('\n').map((l) => l.trim())
}
