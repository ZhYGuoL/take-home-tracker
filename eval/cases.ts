// A fictional test set: what a recruiter pastes, and what a correct reading of it says.
// Every name, email, phone number, handle, and link here is invented. Phones use 555-01xx.
import type { Case, Expected, RosterEntry } from './types'

export const ROSTER: RosterEntry[] = [
  {
    id: 'r-rowan',
    name: 'Rowan Okafor',
    role: 'Founding engineer',
    contacts: ['rowan.okafor@example.com'],
    links: ['https://github.com/example-rokafor/pantry'],
  },
  {
    id: 'r-priya',
    name: 'Priya Raman',
    role: 'Founding engineer',
    contacts: ['priya.raman@example.com', '+15550100142'],
    links: [],
  },
  {
    id: 'r-diego',
    name: 'Diego Alvarez',
    role: 'Founding engineer',
    contacts: ['@diegobuilds'],
    links: [],
  },
  { id: 'r-mei', name: 'Mei Tanaka', role: 'Backend engineer', contacts: [], links: [] },
  {
    id: 'r-sam',
    name: 'Samantha Ortiz',
    role: 'Founding engineer',
    contacts: ['+15550100177'],
    links: [],
  },
  {
    id: 'r-marcus',
    name: 'Marcus Bell',
    role: 'Founding engineer',
    contacts: ['marcus.bell@example.com'],
    links: [],
  },
  {
    id: 'r-lena',
    name: 'Lena Fischer',
    role: 'Product engineer',
    contacts: ['@lenafischer_dev'],
    links: [],
  },
  {
    id: 'r-omar',
    name: 'Omar Haddad',
    role: 'Founding engineer',
    contacts: ['omar@example.com'],
    links: [],
  },
  {
    id: 'r-ana',
    name: 'Ana Costa',
    role: 'Founding engineer',
    contacts: [],
    links: ['https://ana-costa-ledger.vercel.app/'],
  },
]

const LA = 'America/Los_Angeles'
// Wed Sep 30 2026, 1:00 PM in Los Angeles.
const PASTED = '2026-09-30T20:00:00.000Z'

const none: Expected = {
  name: null,
  contacts: [],
  role: null,
  source: null,
  direction: 'in',
  messageAt: null,
  links: [],
  deadline: null,
  needsReply: false,
  match: null,
}

function c(id: string, paste: string, expected: Partial<Expected>, pastedAt = PASTED): Case {
  return { id, paste, pastedAt, zone: LA, expected: { ...none, ...expected } }
}

export const CASES: Case[] = [
  c(
    'imessage-submission-no-name',
    `hey! here's my submission 🙂
https://tidepool-demo-7f3.vercel.app
repo: github.com/example-mkoval/tidepool
took a bit longer on the realtime sync but I think it's solid`,
    {
      links: [
        { url: 'https://tidepool-demo-7f3.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-mkoval/tidepool', kind: 'repo' },
      ],
    },
  ),
  c(
    'gmail-submission-headers',
    `From: Priya Raman <priya.raman@example.com>
Date: Wed, Sep 30, 2026 at 11:42 AM
Subject: Take-home submission: Priya Raman
To: rae@example.com

Hi Rae,

Thanks again for the opportunity. Here is my take-home for the Founding Engineer role:

Live app: https://ledgerline-priya.netlify.app
Code: https://github.com/example-praman/ledgerline

I wrote up the tradeoffs in the README. Happy to walk through it anytime.

Best,
Priya`,
    {
      name: 'Priya Raman',
      contacts: ['priya.raman@example.com'],
      role: 'Founding engineer',
      source: 'email',
      messageAt: '2026-09-30T18:42:00.000Z',
      links: [
        { url: 'https://ledgerline-priya.netlify.app', kind: 'submission' },
        { url: 'https://github.com/example-praman/ledgerline', kind: 'repo' },
      ],
      match: 'r-priya',
    },
  ),
  c(
    'x-dm-submission',
    `Diego Alvarez
@diegobuilds
hey Rae! just shipped it 🚀 live at https://quickslot-diego.vercel.app and code at https://github.com/example-dalvarez/quickslot
12:14 PM`,
    {
      name: 'Diego Alvarez',
      contacts: ['@diegobuilds'],
      source: 'x',
      messageAt: '2026-09-30T19:14:00.000Z',
      links: [
        { url: 'https://quickslot-diego.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-dalvarez/quickslot', kind: 'repo' },
      ],
      match: 'r-diego',
    },
  ),
  c(
    'imessage-question-hosted-auth',
    `quick q - is it ok if I use Supabase for auth or should I roll my own? don't want to lose points for using a hosted thing`,
    { needsReply: true },
  ),
  c(
    'outlook-extension-request',
    `From: Marcus Bell <marcus.bell@example.com>
Sent: Tuesday, September 29, 2026 9:05 PM
To: Rae
Subject: Re: Take-home

Hi Rae, would it be possible to get one extra day on the take-home? A family thing came up this week. Totally understand if not.

Marcus`,
    {
      name: 'Marcus Bell',
      contacts: ['marcus.bell@example.com'],
      source: 'email',
      messageAt: '2026-09-30T04:05:00.000Z',
      needsReply: true,
      match: 'r-marcus',
    },
  ),
  c(
    'outbound-send-48-hours',
    `Hey Sam! Here's the take-home: https://docs.google.com/document/d/1QxExampleDocId42/edit?usp=sharing
You have 48 hours from now. $250 stipend when you submit. Let me know if anything is unclear!`,
    {
      name: 'Sam',
      direction: 'out',
      links: [
        {
          url: 'https://docs.google.com/document/d/1QxExampleDocId42/edit?usp=sharing',
          kind: 'doc',
        },
      ],
      deadline: '2026-10-02T20:00:00.000Z',
      match: 'r-sam',
    },
  ),
  c(
    'outbound-send-friday-et',
    `Hi Nadia, thanks for chatting today! Here is the take-home assignment: https://docs.google.com/document/d/1NadiaTakeHomeExample/edit
Please submit by Friday 5pm ET. Reply here with a deployed link and your repo.`,
    {
      name: 'Nadia',
      direction: 'out',
      links: [
        { url: 'https://docs.google.com/document/d/1NadiaTakeHomeExample/edit', kind: 'doc' },
      ],
      deadline: '2026-10-02T21:00:00.000Z',
    },
  ),
  c(
    'loom-and-gitlab',
    `Here's my walkthrough: https://www.loom.com/share/0f2c1example9a and the repo https://gitlab.com/example-okafor/pantry-planner - lmk if you have trouble running it`,
    {
      links: [
        { url: 'https://www.loom.com/share/0f2c1example9a', kind: 'submission' },
        { url: 'https://gitlab.com/example-okafor/pantry-planner', kind: 'repo' },
      ],
    },
  ),
  c('thanks-only', `thank you so much!! excited to hear back 🙏`, {}),
  c(
    'email-body-signature',
    `Hi Rae,

Sorry for the delay - my submission is live at https://omar-queue.fly.dev and the source is at https://github.com/example-ohaddad/queue-lab.

Thanks!
Omar Haddad
omar@example.com | (555) 010-0163`,
    {
      name: 'Omar Haddad',
      contacts: ['omar@example.com', '+15550100163'],
      links: [
        { url: 'https://omar-queue.fly.dev', kind: 'submission' },
        { url: 'https://github.com/example-ohaddad/queue-lab', kind: 'repo' },
      ],
      match: 'r-omar',
    },
  ),
  c(
    'gmail-reply-with-quote',
    `Thanks Rae! Here it is: https://ana-costa-ledger.vercel.app (repo is linked in the footer)

On Mon, Sep 28, 2026 at 10:02 AM Rae Lin <rae@example.com> wrote:
> Hi Ana, here is the take-home: https://docs.google.com/document/d/1AnaDocExample/edit
> You have 72 hours.`,
    {
      links: [{ url: 'https://ana-costa-ledger.vercel.app', kind: 'submission' }],
      match: 'r-ana',
    },
  ),
  c(
    'chat-export-lines',
    `[9/30/26, 11:16 AM] Lena Fischer: finished! https://pathwise-lena.netlify.app
[9/30/26, 11:17 AM] Lena Fischer: repo: https://github.com/example-lfischer/pathwise`,
    {
      name: 'Lena Fischer',
      messageAt: '2026-09-30T18:16:00.000Z',
      links: [
        { url: 'https://pathwise-lena.netlify.app', kind: 'submission' },
        { url: 'https://github.com/example-lfischer/pathwise', kind: 'repo' },
      ],
      match: 'r-lena',
    },
  ),
  c(
    'linkedin-question',
    `Mei Tanaka sent the following messages at 3:04 PM
Mei Tanaka 3:04 PM
Hi Rae! Just to confirm - should the take-home include tests, or is a working app enough?`,
    {
      name: 'Mei Tanaka',
      source: 'linkedin',
      messageAt: '2026-09-30T22:04:00.000Z',
      needsReply: true,
      match: 'r-mei',
    },
    '2026-09-30T23:30:00.000Z',
  ),
  c(
    'intro-with-role',
    `Hi Rae, this is Kofi Mensah - submitting my take-home for the founding engineer role: https://kofi-sched.vercel.app / https://github.com/example-kmensah/sched`,
    {
      name: 'Kofi Mensah',
      role: 'Founding engineer',
      links: [
        { url: 'https://kofi-sched.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-kmensah/sched', kind: 'repo' },
      ],
    },
  ),
  c(
    'repo-only-matches-known-repo',
    `done! github.com/example-rokafor/pantry (didn't get to deploying, sorry - it runs locally with npm run dev)`,
    {
      links: [{ url: 'https://github.com/example-rokafor/pantry', kind: 'repo' }],
      match: 'r-rowan',
    },
  ),
  c('question-time-zone', `when is it due exactly? is that 5pm your time or mine? I'm in Berlin`, {
    needsReply: true,
  }),
  c('acknowledgement', `got it, thanks! will start tonight`, {}),
  c(
    'outbound-email-72-hours',
    `To: jonah.weiss@example.com
Subject: Take-home for Founding Engineer

Hi Jonah,

Great talking earlier. Here's the take-home: https://docs.google.com/document/d/1JonahExample/edit
You'll have 72 hours. There's a $300 stipend for completing it.

Rae`,
    {
      name: 'Jonah',
      contacts: ['jonah.weiss@example.com'],
      role: 'Founding engineer',
      source: 'email',
      direction: 'out',
      links: [{ url: 'https://docs.google.com/document/d/1JonahExample/edit', kind: 'doc' }],
      deadline: '2026-10-03T20:00:00.000Z',
    },
  ),
  c(
    'email-with-explicit-zone',
    `From: Hana Kim <hana.kim@example.com>
Date: Thu, Oct 1, 2026 at 2:05 AM EDT
Subject: submission

hi! sorry it's late, here: https://hana-notes.vercel.app  https://github.com/example-hkim/notes`,
    {
      name: 'Hana Kim',
      contacts: ['hana.kim@example.com'],
      source: 'email',
      messageAt: '2026-10-01T06:05:00.000Z',
      links: [
        { url: 'https://hana-notes.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-hkim/notes', kind: 'repo' },
      ],
    },
    '2026-10-01T16:00:00.000Z',
  ),
  c('question-signed-first-name', `Can I use Next.js instead of Remix? - Priya`, {
    name: 'Priya',
    needsReply: true,
    match: 'r-priya',
  }),
  c(
    'x-dm-multiline-date-only',
    `Tomás Rivera
@tomasr_codes
Hey! Sorry for the wait
Here's everything:
https://relay-tomas.onrender.com
https://github.com/example-trivera/relay
Let me know what you think!
Sep 29`,
    {
      name: 'Tomás Rivera',
      contacts: ['@tomasr_codes'],
      source: 'x',
      links: [
        { url: 'https://relay-tomas.onrender.com', kind: 'submission' },
        { url: 'https://github.com/example-trivera/relay', kind: 'repo' },
      ],
    },
  ),
  c(
    'x-dm-extension',
    `Diego Alvarez @diegobuilds · 9:12 AM
hey, any chance I could get until Monday? work has been crazy this week`,
    {
      name: 'Diego Alvarez',
      contacts: ['@diegobuilds'],
      source: 'x',
      messageAt: '2026-09-30T16:12:00.000Z',
      needsReply: true,
      match: 'r-diego',
    },
  ),
  c(
    'question-with-docs-link',
    `is this the right API to use? https://developer.example.com/docs/geocoding`,
    {
      links: [{ url: 'https://developer.example.com/docs/geocoding', kind: 'other' }],
      needsReply: true,
    },
  ),
  c(
    'custom-domain-submission',
    `all done → https://pantry.rowan-example.dev (repo is linked in the about page)`,
    { links: [{ url: 'https://pantry.rowan-example.dev', kind: 'submission' }] },
  ),
  c(
    'outbound-date-only',
    `Hi Ines! Take-home is here: https://www.notion.so/example/Take-home-Ines-8f1e2a
Due Oct 5. No stipend for this one unfortunately.`,
    {
      name: 'Ines',
      direction: 'out',
      links: [{ url: 'https://www.notion.so/example/Take-home-Ines-8f1e2a', kind: 'doc' }],
      deadline: '2026-10-06T06:59:59.999Z',
    },
  ),
  c(
    'forwarded-email',
    `---------- Forwarded message ---------
From: Wen Zhou <wen.zhou@example.com>
Date: Wed, Sep 30, 2026 at 9:30 AM
Subject: Take-home
To: Rae <rae@example.com>

Hi Rae - here's my submission: https://wen-canvas.pages.dev
repo: https://github.com/example-wzhou/canvas`,
    {
      name: 'Wen Zhou',
      contacts: ['wen.zhou@example.com'],
      source: 'email',
      messageAt: '2026-09-30T16:30:00.000Z',
      links: [
        { url: 'https://wen-canvas.pages.dev', kind: 'submission' },
        { url: 'https://github.com/example-wzhou/canvas', kind: 'repo' },
      ],
    },
  ),
  c('scheduling-confirmation', `Thursday at 2 works for the follow-up call!`, {
    needsReply: true,
  }),
  c(
    'question-without-question-mark',
    `wondering whether you want me to include a seed script or if an empty db is fine`,
    { needsReply: true },
  ),
  c(
    'submission-with-question',
    `Submitted! https://kai-tracker.vercel.app - also, do you know when I'd hear back?`,
    {
      links: [{ url: 'https://kai-tracker.vercel.app', kind: 'submission' }],
      needsReply: true,
    },
  ),
  c('outbound-answer', `Yes, Supabase is totally fine! Use whatever you're fastest with.`, {
    direction: 'out',
  }),
  c(
    'gmail-copied-header-line',
    `Uma Reyes <uma.reyes@example.com>
3:22 PM (8 minutes ago)
to me

Take-home submission for the Founding Engineer position:
Deployed: https://uma-habits.vercel.app
GitHub: https://github.com/example-ureyes/habits`,
    {
      name: 'Uma Reyes',
      contacts: ['uma.reyes@example.com'],
      role: 'Founding engineer',
      source: 'email',
      messageAt: '2026-09-30T22:22:00.000Z',
      links: [
        { url: 'https://uma-habits.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-ureyes/habits', kind: 'repo' },
      ],
    },
    '2026-09-30T22:30:00.000Z',
  ),
  c(
    'question-first-name-intro',
    `yo it's ben - quick one, is the 48h from when you sent it or from when I opened it?`,
    { name: 'Ben', needsReply: true },
  ),
  c(
    'two-deployments-and-repo',
    `frontend: https://orbit-web-ac.vercel.app
backend: https://orbit-api-ac.vercel.app
repo https://github.com/example-acosta/orbit`,
    {
      links: [
        { url: 'https://orbit-web-ac.vercel.app', kind: 'submission' },
        { url: 'https://orbit-api-ac.vercel.app', kind: 'submission' },
        { url: 'https://github.com/example-acosta/orbit', kind: 'repo' },
      ],
    },
  ),
  c('farewell', `thanks, you too!`, {}),
  c('outbound-nudge', `Hi Priya, just checking in on the take-home - any questions so far?`, {
    name: 'Priya',
    direction: 'out',
    match: 'r-priya',
  }),
  c(
    'running-late',
    `Hey, I'm running a bit behind. Is it ok if I send it tomorrow morning instead?`,
    { needsReply: true },
  ),
  c(
    'mentions-the-doc',
    `per the doc (https://docs.google.com/document/d/1QxExampleDocId42/edit) I built both parts: https://parts-sam.vercel.app`,
    {
      links: [
        { url: 'https://docs.google.com/document/d/1QxExampleDocId42/edit', kind: 'doc' },
        { url: 'https://parts-sam.vercel.app', kind: 'submission' },
      ],
    },
  ),
  c(
    'email-question-phone-signature',
    `Hi Rae, one question on the take-home: should the API be REST or is GraphQL ok?

Thanks,
Samantha Ortiz
(555) 010-0177`,
    {
      name: 'Samantha Ortiz',
      contacts: ['+15550100177'],
      needsReply: true,
      match: 'r-sam',
    },
  ),
]
