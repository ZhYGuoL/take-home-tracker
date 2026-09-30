/**
 * Fills the fake Google Sheet of Avery Stone with fictional candidates, relative to now.
 * It shows every stage and flag, for screenshots and for a look around in `pnpm dev`.
 * Run it while `pnpm dev` runs: `pnpm demo`.
 */
import { deadlineAfterDays, deadlineAt } from '../src/core/deadline'
import type { StoredRecord } from '../src/core/records'
import { toRow } from '../src/core/rows'
import type { Candidate, Entry, Link, Source, Stage } from '../src/core/types'
import { dateIn } from '../src/core/zone'
import { FAKE_GOOGLE_URL } from '../src/shared/fake-google'

const HOUR = 3_600_000
const now = Date.now()
const ago = (hours: number) => new Date(now - hours * HOUR).toISOString()
const LA = 'America/Los_Angeles'
const NY = 'America/New_York'

function person(
  name: string,
  over: Partial<Candidate> & { sentHoursAgo: number; source: Source },
): Candidate {
  const { sentHoursAgo, ...rest } = over
  return {
    id: crypto.randomUUID(),
    name,
    role: 'Founding engineer',
    contacts: [],
    sentAt: ago(sentHoursAgo),
    takeHomeUrl: 'https://docs.example.com/take-home-brief',
    notes: '',
    deadline: null,
    createdAt: ago(sentHoursAgo),
    ...rest,
  }
}

const message = (
  c: Candidate,
  hoursAgo: number,
  text: string,
  opts: { out?: boolean; links?: Link[]; needsReply?: boolean } = {},
): Entry => ({
  id: crypto.randomUUID(),
  candidateId: c.id,
  kind: 'message',
  at: ago(hoursAgo),
  direction: opts.out ? 'out' : 'in',
  text,
  source: c.source,
  links: opts.links ?? [],
  needsReply: opts.needsReply ?? false,
})

const stage = (c: Candidate, hoursAgo: number, to: Stage): Entry => ({
  id: crypto.randomUUID(),
  candidateId: c.id,
  kind: 'stage',
  at: ago(hoursAgo),
  stage: to,
})

const opened = (c: Candidate, hoursAgo: number, url: string): Entry => ({
  id: crypto.randomUUID(),
  candidateId: c.id,
  kind: 'opened',
  at: ago(hoursAgo),
  url,
})

const submission = (url: string): Link[] => [{ url, kind: 'submission' }]

const priya = person('Priya Raman', {
  source: 'imessage',
  contacts: ['+1 555 010 0142'],
  sentHoursAgo: 40,
  deadline: deadlineAfterDays(ago(40), 3, NY),
})
const omar = person('Omar Haddad', {
  source: 'email',
  contacts: ['omar.haddad@example.com'],
  role: 'Product designer',
  sentHoursAgo: 200,
  deadline: deadlineAt(dateIn(now - 30 * HOUR, LA), null, LA),
})
const lena = person('Lena Fischer', {
  source: 'linkedin',
  sentHoursAgo: 120,
  deadline: deadlineAfterDays(ago(120), 4, LA),
})
const mei = person('Mei Tanaka', {
  source: 'other',
  contacts: ['+1 555 010 0123'],
  sentHoursAgo: 170,
  deadline: deadlineAfterDays(ago(170), 3, 'Asia/Tokyo'),
})
const jonas = person('Jonas Berg', {
  source: 'email',
  contacts: ['jonas.berg@example.com'],
  role: 'Product designer',
  sentHoursAgo: 260,
  deadline: deadlineAfterDays(ago(260), 5, LA),
})
const sara = person('Sara Okafor', {
  source: 'x',
  sentHoursAgo: 300,
  deadline: deadlineAfterDays(ago(300), 5, NY),
})
const diego = person('Diego Alvarez', {
  source: 'other',
  sentHoursAgo: 90,
  deadline: deadlineAfterDays(ago(90), 5, LA),
})
const nora = person('Nora Kim', { source: 'other', role: '', sentHoursAgo: 20 })

const items: Array<Candidate | Entry> = [
  priya,
  message(priya, 40, 'Here is the take-home. You have 3 days. Good luck!', { out: true }),
  omar,
  message(omar, 200, 'Here is the design exercise. Please send it by Friday.', { out: true }),
  lena,
  message(lena, 30, 'Done! Live here, code in the repo.', {
    links: submission('https://lena-ledger.example.com'),
  }),
  message(lena, 6, 'Is it OK if I add tests over the weekend?', { needsReply: true }),
  mei,
  message(mei, 60, 'Sorry, a bit late. Here it is.', {
    links: submission('https://github.com/ex-mei/queue'),
  }),
  opened(mei, 50, 'https://github.com/ex-mei/queue'),
  jonas,
  message(jonas, 150, 'My exercise is in the Figma file.', {
    links: submission('https://www.figma.com/file/ex-jonas'),
  }),
  stage(jonas, 100, 'advanced'),
  sara,
  message(sara, 250, 'Submitted, thanks for the chance.', {
    links: submission('https://sara-notes.example.com'),
  }),
  stage(sara, 200, 'passed'),
  diego,
  message(diego, 20, 'All done. Repo and demo inside.', {
    links: submission('https://github.com/ex-diego/tasks'),
  }),
  nora,
  message(nora, 3, 'Can I use a hosted database for the take-home?', { needsReply: true }),
]

const records: StoredRecord[] = items.map((data) =>
  'kind' in data
    ? { id: data.id, type: 'entry', updatedAt: data.at, deleted: false, data }
    : { id: data.id, type: 'candidate', updatedAt: data.createdAt, deleted: false, data },
)

const res = await fetch(`${FAKE_GOOGLE_URL}/__seed`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ sub: 'fake-avery', rows: records.map(toRow) }),
})
if (!res.ok) throw new Error(`The fake Google did not take the demo data: ${res.status}`)
process.stdout.write(
  `Avery Stone now has ${items.filter((i) => !('kind' in i)).length} candidates.\n`,
)
