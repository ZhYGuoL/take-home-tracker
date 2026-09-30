import type { Case, RosterEntry } from './types'

/**
 * Held-out cases, written without reading the extractor or the other eval cases.
 * Every person, address, number, handle, and link here is invented.
 * The recruiter is Jo Park (jo.park@example.com). Her own contacts are never candidate contacts.
 * Link URLs are in the form that `normalizeUrl` returns.
 */

export const HOLDOUT_ROSTER: RosterEntry[] = [
  {
    id: 'h-alexandra-moreno',
    name: 'Alexandra Moreno',
    role: 'Founding engineer',
    contacts: ['alexandra.moreno@example.com'],
    links: ['https://github.com/ex-amoreno/ledger-sync'],
  },
  {
    id: 'h-priya-raman',
    name: 'Priya Raman',
    role: 'Frontend engineer',
    contacts: ['priya.raman@example.org', '+15550100131'],
    links: [],
  },
  {
    id: 'h-priya-natarajan',
    name: 'Priya Natarajan',
    role: 'Backend engineer',
    contacts: ['pnatarajan@example.com'],
    links: ['https://github.com/ex-pnat/queue-service'],
  },
  {
    id: 'h-marcus-lin',
    name: 'Marcus Lin',
    role: 'Full stack engineer',
    contacts: ['@marcuslin_dev'],
    links: [],
  },
  {
    id: 'h-dana-whitfield',
    name: 'Dana Whitfield',
    role: 'Product engineer',
    contacts: ['dana.whitfield@example.com'],
    links: [],
  },
  {
    id: 'h-tomasz-kowal',
    name: 'Tomasz Kowal',
    role: 'Mobile engineer',
    contacts: ['+15550100177'],
    links: [],
  },
  {
    id: 'h-grace-oyelaran',
    name: 'Grace Oyelaran',
    role: 'Design engineer',
    contacts: ['grace.o@example.org'],
    links: [],
  },
  {
    id: 'h-katherine-holloway',
    name: 'Katherine Holloway',
    role: 'Data engineer',
    contacts: ['k.holloway@example.org'],
    links: [],
  },
  {
    id: 'h-leo-fischer',
    name: 'Leo Fischer',
    role: 'Infrastructure engineer',
    contacts: ['@leofischer'],
    links: ['https://github.com/ex-lfischer/infra-kit'],
  },
]

const LA = 'America/Los_Angeles'
const NY = 'America/New_York'
const LONDON = 'Europe/London'

export const HOLDOUT: Case[] = [
  // Gmail web copy, older message this year. Roster match by email.
  {
    id: 'h01-gmail-web-submission-roster-email',
    paste: `Take-home submission: task board
Inbox

Dana Whitfield <dana.whitfield@example.com>
Fri, Oct 2, 9:14 AM (3 days ago)
to me

Hi Jo,

Here is my take-home for the Product Engineer role.

Live app: https://dana-tasks-ex.vercel.app
Code: https://github.com/ex-dwhit/task-board

Thanks again for the chance to work on this!

Dana`,
    pastedAt: '2026-10-05T16:40:00.000Z',
    zone: LA,
    expected: {
      name: 'Dana Whitfield',
      contacts: ['dana.whitfield@example.com'],
      role: 'Product engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-02T16:14:00.000Z',
      links: [
        { url: 'https://dana-tasks-ex.vercel.app/', kind: 'submission' },
        { url: 'https://github.com/ex-dwhit/task-board', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-dana-whitfield',
    },
  },

  // Recruiter's own reply in Gmail web. "get back to you by Friday" is her promise, not a take-home deadline.
  {
    id: 'h02-gmail-web-outgoing-ack-no-deadline',
    paste: `Re: Take-home submission: task board

Jo Park <jo.park@example.com>
9:52 AM (3 minutes ago)
to dana.whitfield@example.com

Hi Dana,

Got it, thank you! The team will review it this week, and I will get back to you by Friday with next steps.

Jo`,
    pastedAt: '2026-10-05T16:55:00.000Z',
    zone: LA,
    expected: {
      name: 'Dana',
      contacts: ['dana.whitfield@example.com'],
      role: null,
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-05T16:52:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: 'h-dana-whitfield',
    },
  },

  // Quoted Gmail reply. "Alex" is a nickname for roster "Alexandra Moreno", from a new personal address.
  {
    id: 'h03-gmail-quoted-reply-nickname-match',
    paste: `Re: Founding engineer take-home
Inbox

Alex Moreno <alex.m.builds@example.org>
Wed, Oct 7, 10:31 PM (11 hours ago)
to me

Hey Jo - finished! Demo video: loom.com/share/7c1e4b2a9d8f4c3b8e6a5d4c3b2a1f0e

The code is in the same repo as before, on a new branch: github.com/ex-amoreno/ledger-sync/tree/take-home

Thanks for your patience with me this week.

Alex

On Mon, Oct 5, 2026 at 9:02 AM Jo Park <jo.park@example.com> wrote:
> Hi Alexandra,
>
> Thanks for the great chat on Friday. The take-home for the Founding Engineer role is attached. Take the time you need, and send me a link when you are done.
>
> Jo`,
    pastedAt: '2026-10-08T16:40:00.000Z',
    zone: LA,
    expected: {
      name: 'Alex Moreno',
      contacts: ['alex.m.builds@example.org'],
      role: 'Founding engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-08T05:31:00.000Z',
      links: [
        { url: 'https://loom.com/share/7c1e4b2a9d8f4c3b8e6a5d4c3b2a1f0e', kind: 'submission' },
        {
          url: 'https://github.com/ex-amoreno/ledger-sync/tree/take-home',
          kind: 'repo',
        },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-alexandra-moreno',
    },
  },

  // Apple Mail forward from a hiring manager. The candidate's time carries its own zone (EDT).
  {
    id: 'h04-apple-mail-forward-from-colleague',
    paste: `FYI, this came to me instead of you.

Rafael

Begin forwarded message:

From: Owen Castellanos <owen.castellanos@example.org>
Subject: Take home - Owen Castellanos
Date: October 9, 2026 at 11:52:18 PM EDT
To: Rafael Ito <rafael.ito@example.com>

Hi Rafael,

Sorry this is cutting it close! The app is live at https://owen-rentcalc.netlify.app and the code is at https://gitlab.com/ex-ocastellanos/rent-calc.

I also recorded a short walkthrough: https://www.loom.com/share/2b9f6e0c4a1d4e7f9c8b7a6d5e4f3a2b

Best,
Owen`,
    pastedAt: '2026-10-10T17:15:00.000Z',
    zone: LA,
    expected: {
      name: 'Owen Castellanos',
      contacts: ['owen.castellanos@example.org'],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-10T03:52:18.000Z',
      links: [
        { url: 'https://owen-rentcalc.netlify.app/', kind: 'submission' },
        { url: 'https://gitlab.com/ex-ocastellanos/rent-calc', kind: 'repo' },
        {
          url: 'https://www.loom.com/share/2b9f6e0c4a1d4e7f9c8b7a6d5e4f3a2b',
          kind: 'submission',
        },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // WhatsApp copy from an unsaved number. Roster match by phone. Drive video is the demo.
  {
    id: 'h05-whatsapp-phone-sender-roster-phone',
    paste:
      "[10/2/26, 9:14 PM] +1 (555) 010-0177: Hi Jo, it's Tomasz! Build is on TestFlight now and I recorded a walkthrough: https://drive.google.com/file/d/1exTkTransitWalkthrough/view?usp=sharing  repo is github.com/ex-tkowal/transit-buddy 🚆",
    pastedAt: '2026-10-03T15:30:00.000Z',
    zone: LA,
    expected: {
      name: 'Tomasz',
      contacts: ['+15550100177'],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-10-03T04:14:00.000Z',
      links: [
        {
          url: 'https://drive.google.com/file/d/1exTkTransitWalkthrough/view?usp=sharing',
          kind: 'submission',
        },
        { url: 'https://github.com/ex-tkowal/transit-buddy', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-tomasz-kowal',
    },
  },

  // X DM copy with the profile card. Mixed-case handle, bare links.
  {
    id: 'h06-x-dm-submission-roster-handle',
    paste: `Leo Fischer
@LeoFischer
Infra nerd. Small tools for big clusters.
Joined April 2017 · 1,288 Followers

yo Jo, take-home is done 🎉
live dashboard: infra-kit-demo-ex.fly.dev
repo (same one I showed you on the call): github.com/ex-lfischer/infra-kit
Oct 15, 8:03 PM`,
    pastedAt: '2026-10-16T16:12:00.000Z',
    zone: LA,
    expected: {
      name: 'Leo Fischer',
      contacts: ['@leofischer'],
      role: null,
      source: 'x',
      direction: 'in',
      messageAt: '2026-10-16T03:03:00.000Z',
      links: [
        { url: 'https://infra-kit-demo-ex.fly.dev/', kind: 'submission' },
        { url: 'https://github.com/ex-lfischer/infra-kit', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-leo-fischer',
    },
  },

  // Plain iMessage text, no name. Only the repo link ties it to a roster candidate.
  {
    id: 'h07-imessage-no-name-roster-link',
    paste:
      'done!! sry for the delay 🙏 its deployed at queue-viz-ex.onrender.com (first load takes ~30s, free tier). code is in the same repo as before: github.com/ex-pnat/queue-service.',
    pastedAt: '2026-10-21T02:05:00.000Z',
    zone: LA,
    expected: {
      name: null,
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [
        { url: 'https://queue-viz-ex.onrender.com/', kind: 'submission' },
        { url: 'https://github.com/ex-pnat/queue-service', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-priya-natarajan',
    },
  },

  // Gmail web with a signature: custom domain app, GitHub profile, LinkedIn profile.
  {
    id: 'h08-gmail-signature-profiles-custom-domain',
    paste: `Senior Full Stack Engineer - take-home
Inbox

Kiran Banerjee <kiran.banerjee@example.com>
Tue, Oct 20, 11:47 PM (9 hours ago)
to me

Hi Jo,

Here's my submission for the Senior Full Stack Engineer take-home.

- App: https://app.lumenboard.example.net
- Code: https://github.com/ex-kbanerjee/lumenboard
- Walkthrough (4 min): https://www.loom.com/share/9d8c7b6a5f4e4d3c2b1a0f9e8d7c6b5a

Thanks!
Kiran

--
Kiran Banerjee
github.com/ex-kbanerjee | linkedin.com/in/ex-kiran-banerjee
(555) 010-0152`,
    pastedAt: '2026-10-21T15:55:00.000Z',
    zone: LA,
    expected: {
      name: 'Kiran Banerjee',
      contacts: ['kiran.banerjee@example.com', '+15550100152'],
      role: 'Senior full stack engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-21T06:47:00.000Z',
      links: [
        { url: 'https://app.lumenboard.example.net/', kind: 'submission' },
        { url: 'https://github.com/ex-kbanerjee/lumenboard', kind: 'repo' },
        {
          url: 'https://www.loom.com/share/9d8c7b6a5f4e4d3c2b1a0f9e8d7c6b5a',
          kind: 'submission',
        },
        { url: 'https://github.com/ex-kbanerjee', kind: 'other' },
        { url: 'https://linkedin.com/in/ex-kiran-banerjee', kind: 'other' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Plain text, all lowercase, email written in mixed case inside the text.
  {
    id: 'h09-plain-lowercase-name-inline-email',
    paste: `hi jo, sorry i missed ur call earlier. take home is up at devon-budget-ex.netlify.app and the repo is github.com/ex-dokafor/budget-app . my email is Devon.Okafor@Example.org if thats easier than texting. thanks again!!
- devon okafor`,
    pastedAt: '2026-10-23T01:20:00.000Z',
    zone: LA,
    expected: {
      name: 'Devon Okafor',
      contacts: ['devon.okafor@example.org'],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [
        { url: 'https://devon-budget-ex.netlify.app/', kind: 'submission' },
        { url: 'https://github.com/ex-dokafor/budget-app', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Outlook block with a Cc to a colleague. The colleague is not a candidate contact. Figma is 'other'.
  {
    id: 'h10-outlook-cc-colleague-figma',
    paste: `From: Grace Oyelaran <Grace.O@example.org>
Sent: Sunday, October 11, 2026 7:26 PM
To: Jo Park <jo.park@example.com>
Cc: Rafael Ito <rafael.ito@example.com>
Subject: Design engineer take-home - Grace Oyelaran

Hi Jo and Rafael,

Please find my take-home below.

Prototype (deployed): https://onboard-flow-ex.vercel.app/
Figma explorations: https://www.figma.com/design/exGraceOnb2026/Onboarding-explorations?node-id=0-1
Repo: https://github.com/ex-goyelaran/onboarding-flow

I focused on the empty states and the mobile layout. Thanks so much for the thoughtful brief!

Warmly,
Grace`,
    pastedAt: '2026-10-12T14:05:00.000Z',
    zone: NY,
    expected: {
      name: 'Grace Oyelaran',
      contacts: ['grace.o@example.org'],
      role: 'Design engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-11T23:26:00.000Z',
      links: [
        { url: 'https://onboard-flow-ex.vercel.app/', kind: 'submission' },
        {
          url: 'https://www.figma.com/design/exGraceOnb2026/Onboarding-explorations?node-id=0-1',
          kind: 'other',
        },
        { url: 'https://github.com/ex-goyelaran/onboarding-flow', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h-grace-oyelaran',
    },
  },

  // Slack copy with emoji shortcodes, bullets, and "(edited)". Time only, so today in her zone.
  {
    id: 'h11-slack-submission-shortcodes',
    paste: `Bea Lindqvist  1:58 PM
Hi Jo! :wave: My submission for the Frontend Engineer take-home is ready :rocket:
• live: https://bea-kanban-ex.pages.dev
• code: https://github.com/ex-blindqvist/kanban-lite
Thanks for the fun exercise! (edited)`,
    pastedAt: '2026-10-27T21:10:00.000Z',
    zone: LA,
    expected: {
      name: 'Bea Lindqvist',
      contacts: [],
      role: 'Frontend engineer',
      source: 'other',
      direction: 'in',
      messageAt: '2026-10-27T20:58:00.000Z',
      links: [
        { url: 'https://bea-kanban-ex.pages.dev/', kind: 'submission' },
        { url: 'https://github.com/ex-blindqvist/kanban-lite', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // LinkedIn copy. A polite "looking forward" closer is not a question.
  {
    id: 'h12-linkedin-submission-polite-closer',
    paste: `Oct 28
Ines Carvalho sent the following message at 6:41 PM
View Ines’ profile
Ines Carvalho
Ines Carvalho  6:41 PM
Hi Jo, I just finished the take-home for the Backend Engineer role. The API is deployed at https://ines-orders-api-ex.fly.dev/docs and the repo is https://github.com/ex-icarvalho/orders-api. Looking forward to your feedback!`,
    pastedAt: '2026-10-29T18:30:00.000Z',
    zone: LA,
    expected: {
      name: 'Ines Carvalho',
      contacts: [],
      role: 'Backend engineer',
      source: 'linkedin',
      direction: 'in',
      messageAt: '2026-10-29T01:41:00.000Z',
      links: [
        { url: 'https://ines-orders-api-ex.fly.dev/docs', kind: 'submission' },
        { url: 'https://github.com/ex-icarvalho/orders-api', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Plain text. Links inside parentheses and before punctuation. Phone with dots.
  {
    id: 'h13-plain-links-in-parens-dotted-phone',
    paste:
      "Hey Jo, Omar Rahimi here. Finished the take-home! You can try it at shelfscan-ex.vercel.app (use the demo account on the login page), and the code's on GitHub (github.com/ex-orahimi/shelf-scan). My number changed btw, it's 555.010.0192.",
    pastedAt: '2026-10-09T23:20:00.000Z',
    zone: LA,
    expected: {
      name: 'Omar Rahimi',
      contacts: ['+15550100192'],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [
        { url: 'https://shelfscan-ex.vercel.app/', kind: 'submission' },
        { url: 'https://github.com/ex-orahimi/shelf-scan', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Gmail app body copy with a quoted thread. Submission plus a real question. Roster match by phone.
  {
    id: 'h14-gmail-app-submission-with-question',
    paste: `Hi Jo,

Submitted my take-home for the frontend engineer role!
App: https://priya-recipes-ex.pages.dev
Repo: https://github.com/ex-praman/recipe-box

One thing: I wasn't sure if you wanted fuzzy search, so for now it only matches exact words. Should I add fuzzy search before the review?

Priya Raman
(555) 010-0131

Sent from my iPhone

On Tue, Oct 6, 2026 at 2:15 PM Jo Park <jo.park@example.com> wrote:

> Hi Priya, here is the frontend take-home. Reply to this email with your links when you are done.`,
    pastedAt: '2026-10-07T14:50:00.000Z',
    zone: LA,
    expected: {
      name: 'Priya Raman',
      contacts: ['+15550100131'],
      role: 'Frontend engineer',
      source: 'email',
      direction: 'in',
      messageAt: null,
      links: [
        { url: 'https://priya-recipes-ex.pages.dev/', kind: 'submission' },
        { url: 'https://github.com/ex-praman/recipe-box', kind: 'repo' },
      ],
      deadline: null,
      needsReply: true,
      match: 'h-priya-raman',
    },
  },

  // London zone, the day after UK clocks go back. Submission that also asks when to expect news.
  {
    id: 'h15-gmail-london-submission-asks-timeline',
    paste: `Take-home: Callum Reid
Inbox

Callum Reid <callum.reid@example.org>
Sun, Oct 25, 8:15 PM (12 hours ago)
to me

Hiya Jo,

All done, cheers for the extra couple of days. Deployed here: https://callum-rota-ex.onrender.com and the repo is https://github.com/ex-creid/rota-planner

When should I expect to hear back about next steps? I'm weighing another offer, so it would help to know.

Thanks,
Callum`,
    pastedAt: '2026-10-26T09:10:00.000Z',
    zone: LONDON,
    expected: {
      name: 'Callum Reid',
      contacts: ['callum.reid@example.org'],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-25T20:15:00.000Z',
      links: [
        { url: 'https://callum-rota-ex.onrender.com/', kind: 'submission' },
        { url: 'https://github.com/ex-creid/rota-planner', kind: 'repo' },
      ],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // Gmail web, message from today (time only). Two questions, phone in signature.
  {
    id: 'h16-gmail-web-today-question',
    paste: `Question - Staff Engineer take-home
Inbox

Hiroshi Tanabe <hiroshi.tanabe@example.org>
8:02 AM (1 hour ago)
to me

Hi Jo,

Before I start: is it OK to use Supabase for auth and the database, or do you want the backend written from scratch?

Also, does the app need to work offline?

Thanks,
Hiroshi Tanabe
(555) 010-0148`,
    pastedAt: '2026-10-06T16:05:00.000Z',
    zone: LA,
    expected: {
      name: 'Hiroshi Tanabe',
      contacts: ['hiroshi.tanabe@example.org', '+15550100148'],
      role: 'Staff engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-06T15:02:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // Slack question with no question mark. Roster match by full name only.
  {
    id: 'h17-slack-question-no-question-mark',
    paste: `Marcus Lin  10:42 AM
hey Jo, quick one. the brief says "use any framework" but the starter repo ships with Next. ok if I rip that out and use Remix instead (edited)`,
    pastedAt: '2026-10-14T18:05:00.000Z',
    zone: LA,
    expected: {
      name: 'Marcus Lin',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-10-14T17:42:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h-marcus-lin',
    },
  },

  // Plain iMessage. First name only, and the roster has two Priyas, so no match.
  {
    id: 'h18-imessage-shared-first-name-no-match',
    paste:
      'Hi Jo, this is Priya from the call yesterday! For the take-home do you want tests, or is a short README about the tradeoffs enough',
    pastedAt: '2026-10-01T19:30:00.000Z',
    zone: LA,
    expected: {
      name: 'Priya',
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // Outlook block. First name only, but the email (mixed case) matches one of the two Priyas.
  {
    id: 'h19-outlook-first-name-email-match',
    paste: `From: Priya <PNatarajan@example.com>
Sent: Thursday, October 15, 2026 1:12 PM
To: Jo Park <jo.park@example.com>
Subject: queue take-home: LISTEN/NOTIFY ok?

Hi Jo,

For the queue exercise, would it be acceptable to use Postgres LISTEN/NOTIFY instead of running Redis or Kafka? It keeps the setup to a single docker compose file.

- P`,
    pastedAt: '2026-10-15T20:40:00.000Z',
    zone: LA,
    expected: {
      name: 'Priya',
      contacts: ['pnatarajan@example.com'],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-15T20:12:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h-priya-natarajan',
    },
  },

  // Outlook, New York zone. Extension request that names dates. Inbound, so no deadline.
  {
    id: 'h20-outlook-extension-request-inbound-deadline',
    paste: `From: Katherine Holloway <katie.holloway.dev@example.com>
Sent: Tuesday, October 13, 2026 4:47 PM
To: Jo Park <jo.park@example.com>
Subject: RE: Data Engineer take-home - extension?

Hi Jo,

I'm so sorry to ask, but my daughter got sick this week and I lost two evenings. Would it be possible to have until Monday the 19th instead of this Friday? The ingestion part is done, I just need to write the tests.

Thank you for understanding,
Katie

Katherine Holloway
555-010-0164`,
    pastedAt: '2026-10-13T21:30:00.000Z',
    zone: NY,
    expected: {
      name: 'Katherine Holloway',
      contacts: ['katie.holloway.dev@example.com', '+15550100164'],
      role: 'Data engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-13T20:47:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h-katherine-holloway',
    },
  },

  // Apple Mail copy of the recruiter's reply. Explicit date, time, and zone.
  {
    id: 'h21-apple-mail-outgoing-new-deadline-et',
    paste: `From: Jo Park <jo.park@example.com>
Subject: Re: Data Engineer take-home - extension?
Date: October 13, 2026 at 6:02:44 PM EDT
To: Katherine Holloway <katie.holloway.dev@example.com>

Hi Katie,

Of course, and I hope she feels better soon. Your new deadline is Monday, October 19 at 5:00 PM ET. No need to rush the tests.

Jo`,
    pastedAt: '2026-10-13T22:10:00.000Z',
    zone: NY,
    expected: {
      name: 'Katherine Holloway',
      contacts: ['katie.holloway.dev@example.com'],
      role: 'Data engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-13T22:02:44.000Z',
      links: [],
      deadline: '2026-10-19T21:00:00.000Z',
      needsReply: false,
      match: 'h-katherine-holloway',
    },
  },

  // X DM, lowercase, emoji. Extension request that names a day. Inbound, so no deadline.
  {
    id: 'h22-x-dm-lowercase-extension-request',
    paste: `Sol Reyes
@SolReyes_Codes
frontend dev · coffee · climbing
Joined June 2021 · 402 Followers

hey jo!! any chance i could get till sunday night for the take home? work has been insane this week 😅
Oct 22, 2026, 11:58 PM`,
    pastedAt: '2026-10-23T15:10:00.000Z',
    zone: LA,
    expected: {
      name: 'Sol Reyes',
      contacts: ['@solreyes_codes'],
      role: null,
      source: 'x',
      direction: 'in',
      messageAt: '2026-10-23T06:58:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // LinkedIn copy with pronouns next to the name. Scheduling request.
  {
    id: 'h23-linkedin-scheduling-pronouns',
    paste: `Today
Nadia Farouk sent the following message at 3:18 PM
View Nadia’s profile
Nadia Farouk
Nadia Farouk (She/Her)  3:18 PM
Hi Jo! I submitted the design engineer take-home on Friday. For the review call, I'm traveling Thursday and Friday. Could we do next Tuesday or Wednesday instead? Happy to work around your calendar.`,
    pastedAt: '2026-10-12T23:02:00.000Z',
    zone: LA,
    expected: {
      name: 'Nadia Farouk',
      contacts: [],
      role: 'Design engineer',
      source: 'linkedin',
      direction: 'in',
      messageAt: '2026-10-12T22:18:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // Candidate is blocked and waits on her, with no question. The assignment link is a 'doc'.
  {
    id: 'h24-gmail-blocked-no-access-doc-link',
    paste: `Re: Backend engineer take-home
Inbox

Farah Qureshi <farah.qureshi@example.com>
9:58 AM (22 minutes ago)
to me

Hi Jo,

The Notion link you sent (https://www.notion.so/ex-acme/Backend-take-home-2c4e6a8b) shows "You don't have access to this page" for me. I requested access from the page, but nobody has approved it yet.

Farah
+1 555 010 0119`,
    pastedAt: '2026-10-19T17:20:00.000Z',
    zone: LA,
    expected: {
      name: 'Farah Qureshi',
      contacts: ['farah.qureshi@example.com', '+15550100119'],
      role: 'Backend engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-19T16:58:00.000Z',
      links: [{ url: 'https://www.notion.so/ex-acme/Backend-take-home-2c4e6a8b', kind: 'doc' }],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // Candidate forwards their own earlier submission and asks if she saw it. The newest message sets messageAt.
  {
    id: 'h25-gmail-self-forward-nudge',
    paste: `Fwd: Take-home submission - Theo Marchetti
Inbox

Theo Marchetti <theo.marchetti@example.org>
8:12 AM (1 hour ago)
to me

Hi Jo, forwarding this in case it got buried. Did you get a chance to look at it?

Theo

---------- Forwarded message ---------
From: Theo Marchetti <theo.marchetti@example.org>
Date: Tue, Oct 20, 2026 at 5:44 PM
Subject: Take-home submission - Theo Marchetti
To: Jo Park <jo.park@example.com>


Hi Jo,

Here is my take-home for the Senior Backend Engineer position.

Repo: https://github.com/ex-tmarchetti/rate-limiter
Live demo: https://rate-limiter-ex.netlify.app

Best,
Theo Marchetti`,
    pastedAt: '2026-10-27T16:30:00.000Z',
    zone: LA,
    expected: {
      name: 'Theo Marchetti',
      contacts: ['theo.marchetti@example.org'],
      role: 'Senior backend engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-27T15:12:00.000Z',
      links: [
        { url: 'https://github.com/ex-tmarchetti/rate-limiter', kind: 'repo' },
        { url: 'https://rate-limiter-ex.netlify.app/', kind: 'submission' },
      ],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },

  // WhatsApp with a saved contact name. Candidate states her own target time. Inbound, so no deadline.
  {
    id: 'h26-whatsapp-heads-up-inbound-deadline',
    paste:
      "[10/14/26, 8:31 AM] Lena Brandt: Morning Jo! Heads up, I'll have the take-home to you by Friday 5pm PT at the latest. Backend is done, I'm polishing the UI now 🙂 My cell is 5550100133 if texting is easier.",
    pastedAt: '2026-10-14T16:00:00.000Z',
    zone: LA,
    expected: {
      name: 'Lena Brandt',
      contacts: ['+15550100133'],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-10-14T15:31:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Gmail web receipt confirmation. The quoted outgoing text has no deadline.
  {
    id: 'h27-gmail-receipt-confirmation',
    paste: `Re: Your take-home for the Platform Engineer role
Inbox

Arjun Pillai <arjun.pillai@example.com>
4:48 PM (17 minutes ago)
to me

Got it, thanks Jo! I'll start this weekend and send it over by Wednesday.

Arjun

On Fri, Oct 2, 2026 at 2:30 PM Jo Park <jo.park@example.com> wrote:
> Hi Arjun,
> Here is the take-home for the Platform Engineer role. Please send it back when you can.
> Jo`,
    pastedAt: '2026-10-03T00:05:00.000Z',
    zone: LA,
    expected: {
      name: 'Arjun Pillai',
      contacts: ['arjun.pillai@example.com'],
      role: 'Platform engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-10-02T23:48:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // LinkedIn copy with a 24-hour clock, London zone. Withdrawal, nothing to answer.
  {
    id: 'h28-linkedin-london-withdrawal',
    paste: `Today
Freya Lawson sent the following message at 10:22
View Freya’s profile
Freya Lawson
Freya Lawson  10:22
Hi Jo, thank you so much for the time you and the team put into this. I've accepted an offer elsewhere, so please withdraw me from the Staff Engineer process. I won't be submitting the take-home. All the best!`,
    pastedAt: '2026-10-28T11:00:00.000Z',
    zone: LONDON,
    expected: {
      name: 'Freya Lawson',
      contacts: [],
      role: 'Staff engineer',
      source: 'linkedin',
      direction: 'in',
      messageAt: '2026-10-28T10:22:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },

  // Recruiter's outgoing text, copied from the compose box. "72 hours" counts from pastedAt.
  {
    id: 'h29-plain-outgoing-72-hours',
    paste: `Hi Samir,

Great talking today! Here is the take-home for the Full Stack Engineer role: https://www.notion.so/ex-acme/Full-stack-take-home-3f9a1c2e7b8d

You have 72 hours. Please reply with a link to the deployed app and to your repo. If anything in the brief is unclear, just ask.

Best,
Jo`,
    pastedAt: '2026-10-05T17:20:00.000Z',
    zone: LA,
    expected: {
      name: 'Samir',
      contacts: [],
      role: 'Full stack engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [
        {
          url: 'https://www.notion.so/ex-acme/Full-stack-take-home-3f9a1c2e7b8d',
          kind: 'doc',
        },
      ],
      deadline: '2026-10-08T17:20:00.000Z',
      needsReply: false,
      match: null,
    },
  },

  // LinkedIn outgoing, 72 real hours across the US clock change on 2026-11-01.
  // The message time and pastedAt are the same minute, so both anchors give the same answer.
  {
    id: 'h30-linkedin-outgoing-72-hours-across-dst',
    paste: `Today
Jo Park sent the following message at 12:00 PM
View Jo’s profile
Jo Park
Jo Park  12:00 PM
Hi Wren, thanks again for your time today. Here's the Mobile Engineer take-home: https://docs.google.com/document/d/1exMobileTakeHome2026v3/edit?usp=sharing

You have 72 hours to finish it. Send me the TestFlight or APK link and your repo when you're done.`,
    pastedAt: '2026-10-30T19:00:00.000Z',
    zone: LA,
    expected: {
      name: 'Wren',
      contacts: [],
      role: 'Mobile engineer',
      source: 'linkedin',
      direction: 'out',
      messageAt: '2026-10-30T19:00:00.000Z',
      links: [
        {
          url: 'https://docs.google.com/document/d/1exMobileTakeHome2026v3/edit?usp=sharing',
          kind: 'doc',
        },
      ],
      deadline: '2026-11-02T19:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },

  // Gmail web, recruiter in New York. The deadline states its own zone (PT).
  {
    id: 'h31-gmail-outgoing-monday-9am-pt-from-ny',
    paste: `Re: Backend Engineer take-home

Jo Park <jo.park@example.com>
Thu, Oct 8, 3:12 PM (20 hours ago)
to Ivan

Hi Ivan,

No problem at all. Let's move your deadline to Monday 9am PT so you have the weekend. Reply here with your repo and a short Loom when you're done.

Jo`,
    pastedAt: '2026-10-09T15:20:00.000Z',
    zone: NY,
    expected: {
      name: 'Ivan',
      contacts: [],
      role: 'Backend engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-08T19:12:00.000Z',
      links: [],
      deadline: '2026-10-12T16:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },

  // Plain outgoing iMessage. "due 10/9" is a date without a time, in her own zone.
  {
    id: 'h32-imessage-outgoing-due-date-only',
    paste:
      "Hi Hana! It's Jo from Acme. Sending over the design engineer take-home: notion.so/ex-acme/Design-engineer-brief-8d2e41 . It's due 10/9, and text me if you get stuck!",
    pastedAt: '2026-10-02T20:45:00.000Z',
    zone: LA,
    expected: {
      name: 'Hana',
      contacts: [],
      role: 'Design engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [{ url: 'https://notion.so/ex-acme/Design-engineer-brief-8d2e41', kind: 'doc' }],
      deadline: '2026-10-10T06:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },

  // WhatsApp outgoing in UK format (day first, 24-hour clock). "end of day Friday" in London, still BST.
  {
    id: 'h33-whatsapp-uk-outgoing-end-of-day-friday',
    paste:
      "[14/10/2026, 17:05:11] Jo Park: Hi Tobi, here's the take-home for the Platform Engineer role: https://docs.google.com/document/d/1exPlatformTakeHomeUK/edit - no rush, but please send it over by end of day Friday. A repo plus a short write-up is perfect 👍",
    pastedAt: '2026-10-14T16:10:00.000Z',
    zone: LONDON,
    expected: {
      name: 'Tobi',
      contacts: [],
      role: 'Platform engineer',
      source: 'other',
      direction: 'out',
      messageAt: '2026-10-14T16:05:11.000Z',
      links: [
        { url: 'https://docs.google.com/document/d/1exPlatformTakeHomeUK/edit', kind: 'doc' },
      ],
      deadline: '2026-10-16T22:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },

  // Slack outgoing from a recruiter in LA. The deadline names ET. Her own question does not need a reply.
  {
    id: 'h34-slack-outgoing-eod-friday-et',
    paste: `Jo Park  4:20 PM
Hi Ren! Here is the take-home for the ML Engineer role: https://www.notion.so/ex-acme/ML-engineer-take-home-5b7c9d
Could you aim for end of day Friday ET? The panel is in New York. Does that work for you?`,
    pastedAt: '2026-10-21T23:25:00.000Z',
    zone: LA,
    expected: {
      name: 'Ren',
      contacts: [],
      role: 'ML engineer',
      source: 'other',
      direction: 'out',
      messageAt: '2026-10-21T23:20:00.000Z',
      links: [{ url: 'https://www.notion.so/ex-acme/ML-engineer-take-home-5b7c9d', kind: 'doc' }],
      deadline: '2026-10-24T03:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },

  // Outgoing, London. "3 days" is three calendar days at the same wall-clock time (D8),
  // across the UK clock change on 2026-10-25. 72 real hours would be one hour earlier.
  {
    id: 'h35-plain-outgoing-3-days-across-uk-dst',
    paste: `Hi Mei,

Thanks for making time today. As discussed, here is the take-home for the Senior Frontend Engineer role:
https://docs.google.com/document/d/1exSeniorFEBriefLondon/edit

You have 3 days from now to send it back. A deployed link and a repo are both fine.

Cheers,
Jo`,
    pastedAt: '2026-10-23T14:30:00.000Z',
    zone: LONDON,
    expected: {
      name: 'Mei',
      contacts: [],
      role: 'Senior frontend engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [
        { url: 'https://docs.google.com/document/d/1exSeniorFEBriefLondon/edit', kind: 'doc' },
      ],
      deadline: '2026-10-26T15:30:00.000Z',
      needsReply: false,
      match: null,
    },
  },

  // Outlook outgoing follow-up. It asks a question, but outgoing messages never need a reply.
  {
    id: 'h36-outlook-outgoing-check-in',
    paste: `From: Jo Park <jo.park@example.com>
Sent: Thursday, October 8, 2026 9:30 AM
To: Grace Oyelaran <grace.o@example.org>
Subject: Checking in on the take-home

Hi Grace,

Just checking in. How is the take-home going? No pressure, I only want to make sure the brief made sense. If you need a few more days, let me know.

Jo`,
    pastedAt: '2026-10-08T16:45:00.000Z',
    zone: LA,
    expected: {
      name: 'Grace Oyelaran',
      contacts: ['grace.o@example.org'],
      role: null,
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-08T16:30:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: 'h-grace-oyelaran',
    },
  },

  // X DM where the recruiter is the sender. The profile card shows the candidate. Scheduling link is 'other'.
  {
    id: 'h37-x-dm-outgoing-scheduling-link',
    paste: `Marcus Lin
@MarcusLin_Dev
full stack, mostly TypeScript. building in public.
Joined January 2020 · 2,310 Followers

Hi Marcus! Loved your take-home. Could you grab a slot for a 45 min debrief with the team? calendly.com/ex-jo-park/debrief
Oct 16, 2:40 PM`,
    pastedAt: '2026-10-16T21:45:00.000Z',
    zone: LA,
    expected: {
      name: 'Marcus Lin',
      contacts: ['@marcuslin_dev'],
      role: null,
      source: 'x',
      direction: 'out',
      messageAt: '2026-10-16T21:40:00.000Z',
      links: [{ url: 'https://calendly.com/ex-jo-park/debrief', kind: 'other' }],
      deadline: null,
      needsReply: false,
      match: 'h-marcus-lin',
    },
  },

  // Plain outgoing iMessage. "48 hours" counts from pastedAt. The role keeps the "iOS" casing.
  {
    id: 'h38-imessage-outgoing-48-hours-ios',
    paste: `Hi Jonah, it's Jo Park. Great chatting earlier! Here's the take-home for the iOS Engineer role: https://docs.google.com/document/d/1exiOSTakeHome2026/edit
You'll have 48 hours from when you get this. Reply here with a TestFlight link or a screen recording plus the repo when you're done 🙌`,
    pastedAt: '2026-10-20T18:00:00.000Z',
    zone: LA,
    expected: {
      name: 'Jonah',
      contacts: [],
      role: 'iOS engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [{ url: 'https://docs.google.com/document/d/1exiOSTakeHome2026/edit', kind: 'doc' }],
      deadline: '2026-10-22T18:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },

  // Gmail web outgoing, recruiter in New York. Date without a time, in the zone the message states (Pacific).
  {
    id: 'h39-gmail-outgoing-date-only-stated-zone',
    paste: `Take-home: Senior Data Engineer

Jo Park <jo.park@example.com>
12:41 PM (19 minutes ago)
to Elif

Hi Elif,

Thanks again for the great conversation. The take-home is here: https://docs.google.com/document/d/1exSrDataEngTakeHome/edit

Please send your repo by Friday, October 16 (Pacific time, since the team is in Seattle). If you have questions about the dataset, just reply to this email.

Best,
Jo`,
    pastedAt: '2026-10-12T17:00:00.000Z',
    zone: NY,
    expected: {
      name: 'Elif',
      contacts: [],
      role: 'Senior data engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-12T16:41:00.000Z',
      links: [{ url: 'https://docs.google.com/document/d/1exSrDataEngTakeHome/edit', kind: 'doc' }],
      deadline: '2026-10-17T06:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },

  // Outlook outgoing with the recruiter's own signature phone and email. Same first name and role as a
  // roster candidate (Leo Fischer), but a different person.
  {
    id: 'h40-outlook-outgoing-own-signature-shared-first-name',
    paste: `From: Jo Park <jo.park@example.com>
Sent: Monday, October 19, 2026 3:02 PM
To: Leo Anand <leo.anand@example.com>
Subject: Infrastructure Engineer take-home

Hi Leo,

Thanks for chatting with the team today. Here is the take-home: https://www.notion.so/ex-acme/Infra-take-home-a41c77

Please send your repo and a short write-up by noon on Thursday the 22nd. Reply here or text me if anything blocks you.

Jo Park
Recruiting, Acme
(555) 010-0100 | jo.park@example.com`,
    pastedAt: '2026-10-19T22:10:00.000Z',
    zone: LA,
    expected: {
      name: 'Leo Anand',
      contacts: ['leo.anand@example.com'],
      role: 'Infrastructure engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-10-19T22:02:00.000Z',
      links: [{ url: 'https://www.notion.so/ex-acme/Infra-take-home-a41c77', kind: 'doc' }],
      deadline: '2026-10-22T19:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },
]
