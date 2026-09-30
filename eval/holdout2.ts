import type { Case, RosterEntry } from './types'

/**
 * Second held-out set (D14).
 * A separate agent wrote it without seeing the extractor, the development set, or the first held-out set.
 * All people, contacts, and links are fictional.
 * The recruiter is Sam Ortega (sam.ortega@example.com).
 */
export const HOLDOUT2_ROSTER: RosterEntry[] = [
  {
    id: 'h2r-priya-raman',
    name: 'Priya Raman',
    role: 'Senior iOS engineer',
    contacts: ['priya.raman@example.com', '@priyabuilds'],
    links: ['https://github.com/ex-priyar/tidepool-ios'],
  },
  {
    id: 'h2r-priya-nair',
    name: 'Priya Nair',
    role: 'Product designer',
    contacts: ['priya.nair@example.org', '+15550100112'],
    links: [],
  },
  {
    id: 'h2r-marcus-bell',
    name: 'Marcus Bell',
    role: 'Staff backend engineer',
    contacts: ['marcus.bell@example.org'],
    links: ['https://github.com/ex-mbell/ledger-api'],
  },
  {
    id: 'h2r-alexander-brandt',
    name: 'Alexander Brandt',
    role: 'ML engineer',
    contacts: ['a.brandt@example.com', '+15550100134'],
    links: [],
  },
  {
    id: 'h2r-katherine-oyelaran',
    name: 'Katherine Oyelaran',
    role: 'Founding engineer',
    contacts: ['@kat_oye'],
    links: ['https://kat-notes-ex.vercel.app/'],
  },
  {
    id: 'h2r-tomasz-wolski',
    name: 'Tomasz Wolski',
    role: 'Platform engineer',
    contacts: ['tomasz.wolski@example.com'],
    links: ['https://gitlab.com/ex-twolski/queue-bench'],
  },
  {
    id: 'h2r-jordan-lee',
    name: 'Jordan Lee',
    role: 'Frontend engineer',
    contacts: ['jordan.lee@example.org'],
    links: [],
  },
  {
    id: 'h2r-theodore-lindqvist',
    name: 'Theodore Lindqvist',
    role: 'Data engineer',
    contacts: ['+15550100147'],
    links: [],
  },
  {
    id: 'h2r-amara-diallo',
    name: 'Amara Diallo',
    role: 'Design engineer',
    contacts: ['amara.diallo@example.com', '@amaradraws'],
    links: [],
  },
  {
    id: 'h2r-wen-zhao',
    name: 'Wen Zhao',
    role: 'Founding engineer',
    contacts: ['wen.zhao@example.org'],
    links: ['https://github.com/ex-wenz'],
  },
]

export const HOLDOUT2: Case[] = [
  {
    id: 'h2-01-gmail-web-submission-today',
    paste: `Take-home submission - Founding Engineer
Inbox

Dana Whitfield <dana.whitfield@example.com>
2:14 PM (2 hours ago)\t
to me

Hi Sam,

Here's my take-home for the Founding Engineer role:

Live app: https://tallyho-ex.vercel.app
Repo: https://github.com/ex-danaw/tallyho

I kept the scope to what the brief asked for and wrote up the tradeoffs in the README. Thanks for the fun problem!

Best,
Dana Whitfield
(555) 010-0121`,
    pastedAt: '2026-11-04T22:21:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Dana Whitfield',
      contacts: ['dana.whitfield@example.com', '+15550100121'],
      role: 'Founding engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-04T20:14:00.000Z',
      links: [
        { url: 'https://tallyho-ex.vercel.app/', kind: 'submission' },
        { url: 'https://github.com/ex-danaw/tallyho', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-02-gmail-web-question-yesterday',
    paste: `Re: Take-home for Senior Backend Engineer
Inbox

Kofi Mensah <kofi.mensah@example.org>
Wed, Nov 4, 4:51 PM (16 hours ago)\t
to me

Hey Sam,

Quick question before I go further. The brief says "persist the queue". Can I use Supabase for storage, or do you want me to stick to SQLite so it runs locally?

Also is it fine if I skip auth entirely?

Thanks,
Kofi`,
    pastedAt: '2026-11-05T15:40:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Kofi Mensah',
      contacts: ['kofi.mensah@example.org'],
      role: 'Senior backend engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-04T22:51:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-03-outlook-desktop-submission-angle-links',
    paste: `From: Marcus Bell <marcus.bell@example.org>
Sent: Tuesday, November 10, 2026 3:47 PM
To: Sam Ortega <sam.ortega@example.com>
Subject: RE: Take-home - Staff Backend Engineer

Hi Sam,

Submitting my take-home. The code is here <https://github.com/ex-mbell/ledger-api> on the "takehome" branch, and the API is deployed at <https://ledger-api-ex.onrender.com/docs>.

Load test results are in the bench folder. Looking forward to hearing back.

Regards,
Marcus Bell
+1 555-010-0139`,
    pastedAt: '2026-11-10T23:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Marcus Bell',
      contacts: ['marcus.bell@example.org', '+15550100139'],
      role: 'Staff backend engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-10T21:47:00.000Z',
      links: [
        { url: 'https://github.com/ex-mbell/ledger-api', kind: 'repo' },
        { url: 'https://ledger-api-ex.onrender.com/docs', kind: 'submission' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h2r-marcus-bell',
    },
  },
  {
    id: 'h2-04-outlook-web-extension-request',
    paste: `RE: take-home timeline

Tomasz Wolski <tomasz.wolski@example.com>
Thu 11/5/2026 8:03 AM
To: Sam Ortega

Hi Sam,

Sorry for the late notice, we had a production incident this week and I've barely had time to touch the take-home. Would it be possible to get an extra two days? I can have it to you by Monday Nov 9 end of day.

Thanks for understanding,
Tomasz`,
    pastedAt: '2026-11-05T14:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Tomasz Wolski',
      contacts: ['tomasz.wolski@example.com'],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-05T14:03:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h2r-tomasz-wolski',
    },
  },
  {
    id: 'h2-05-apple-mail-pst-date-paren-links',
    paste: `From: Hana Sato <hana.sato@example.com>
Subject: iOS Engineer take-home - Hana Sato
Date: November 6, 2026 at 9:20:14 PM PST
To: Sam Ortega <sam.ortega@example.com>

Hi Sam!

Here is a short demo video (https://www.loom.com/share/ex4f9c2a7d1e) and the code is on GitHub (github.com/ex-hanasato/pantry-scan).

The app builds with Xcode 17, no extra setup. I ran out of time for offline mode but described how I'd do it in NOTES.md.

Thanks so much,
Hana`,
    pastedAt: '2026-11-07T16:02:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Hana Sato',
      contacts: ['hana.sato@example.com'],
      role: 'iOS engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-07T05:20:14.000Z',
      links: [
        { url: 'https://www.loom.com/share/ex4f9c2a7d1e', kind: 'submission' },
        { url: 'https://github.com/ex-hanasato/pantry-scan', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-06-gmail-ios-quoted-reply-nickname',
    paste: `Hi Sam, thanks for sending this over! One thing I wasn't sure about, the brief mentions webhooks but not whether you want retries handled. I'll assume yes unless you tell me otherwise but let me know

Kat

Sent from my iPhone

On Mon, Nov 9, 2026 at 10:02 AM Sam Ortega <sam.ortega@example.com> wrote:

> Hi Kat,
>
> Great chatting today. The take-home is attached. Let me know if anything is unclear.
>
> Sam`,
    pastedAt: '2026-11-10T01:15:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Kat',
      contacts: [],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: null,
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h2r-katherine-oyelaran',
    },
  },
  {
    id: 'h2-07-slack-lowercase-name-question',
    paste: `jordan lee  10:42 AM
hey Sam! :wave: quick q on the take-home - should search be debounced client side or is it ok to hit the api on every keystroke? the mock server is pretty slow lol
also the figma link in the brief 404s for me :sweat_smile:`,
    pastedAt: '2026-11-12T17:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Jordan Lee',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-12T16:42:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h2r-jordan-lee',
    },
  },
  {
    id: 'h2-08-slack-bracket-late-night-custom-domain',
    paste: `[11:48 PM] Noor Haddad: ok it's finally deployed!! app.brightcart.example.net - login is demo / demo123. repo is gitlab.com/ex-noorh/brightcart. going to sleep now 😴`,
    pastedAt: '2026-11-13T14:10:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Noor Haddad',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-13T05:48:00.000Z',
      links: [
        { url: 'https://app.brightcart.example.net/', kind: 'submission' },
        { url: 'https://gitlab.com/ex-noorh/brightcart', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-09-telegram-berlin-nickname-question',
    paste: `Alex Brandt, [Nov 3, 2026 at 9:15 AM]:
Morning Sam! For the ranking task, is it ok to use a pretrained embedding model from Hugging Face or should everything be trained from scratch on the provided data? I'd also need a GPU for the full dataset, so I'll subsample to 10% unless you say otherwise`,
    pastedAt: '2026-11-03T09:02:00.000Z',
    zone: 'Europe/Berlin',
    expected: {
      name: 'Alex Brandt',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-03T08:15:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h2r-alexander-brandt',
    },
  },
  {
    id: 'h2-10-discord-today-demo-video',
    paste: `Mei Tanaka - Today at 9:15 AM
hi Sam! submission for the design engineer take-home 🎉
demo video: https://youtu.be/exM3iT4nK0a
live: https://mei-moodboard.pages.dev
code: https://github.com/ex-meitanaka/moodboard
lmk if the video doesn't load`,
    pastedAt: '2026-11-16T17:40:00.000Z',
    zone: 'America/Los_Angeles',
    expected: {
      name: 'Mei Tanaka',
      contacts: [],
      role: 'Design engineer',
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-16T17:15:00.000Z',
      links: [
        { url: 'https://youtu.be/exM3iT4nK0a', kind: 'submission' },
        { url: 'https://mei-moodboard.pages.dev/', kind: 'submission' },
        { url: 'https://github.com/ex-meitanaka/moodboard', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-11-whatsapp-unsaved-number-scheduling',
    paste: `[2:07 PM, 11/11/2026] +1 (555) 010-0112: Hi Sam, it's Priya! Just finished the case study, sent it to your email a few min ago. Would Friday at 11 work for the walkthrough call? Otherwise anytime Monday`,
    pastedAt: '2026-11-11T20:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Priya',
      contacts: ['+15550100112'],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-11T20:07:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: 'h2r-priya-nair',
    },
  },
  {
    id: 'h2-12-x-dm-profile-header-date-mention',
    paste: `Ines Moreau
@InesMoreau_dev
Joined April 2019 · 812 Followers

hey Sam, got the take-home, thanks! I'm at a conference until the 17th - could I send it by Nov 19 instead of the 16th?
Nov 12, 2026, 7:31 PM`,
    pastedAt: '2026-11-13T02:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Ines Moreau',
      contacts: ['@inesmoreau_dev'],
      role: null,
      source: 'x',
      direction: 'in',
      messageAt: '2026-11-13T01:31:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-13-linkedin-submission',
    paste: `Chioma Eze sent the following message at 3:12 PM
View Chioma’s profile
Chioma Eze
Chioma Eze  3:12 PM
Hi Sam, as promised here's my take-home for the Design Engineer role 🙂

Prototype: https://chioma-ledger-ui.netlify.app
Source: https://github.com/ex-chiomaeze/ledger-ui

Happy to walk through any of it on a call. Have a great weekend!`,
    pastedAt: '2026-11-06T21:40:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Chioma Eze',
      contacts: [],
      role: 'Design engineer',
      source: 'linkedin',
      direction: 'in',
      messageAt: '2026-11-06T21:12:00.000Z',
      links: [
        { url: 'https://chioma-ledger-ui.netlify.app/', kind: 'submission' },
        { url: 'https://github.com/ex-chiomaeze/ledger-ui', kind: 'repo' },
      ],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-14-imessage-no-name-repo-owner-match',
    paste: `just pushed v2 - same repo, new branch: github.com/ex-wenz/ledgerlite/tree/v2
live at ledgerlite-ex.fly.dev (might take 30s to wake up, free tier)`,
    pastedAt: '2026-11-14T18:20:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: null,
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [
        { url: 'https://github.com/ex-wenz/ledgerlite/tree/v2', kind: 'repo' },
        { url: 'https://ledgerlite-ex.fly.dev/', kind: 'submission' },
      ],
      deadline: null,
      needsReply: false,
      match: 'h2r-wen-zhao',
    },
  },
  {
    id: 'h2-15-imessage-question-no-question-mark',
    paste: `Hi Sam its Ravi Chandrasekar (the ML engineer candidate from tuesday). Quick one on the take home - the dataset link in the brief gives me an access denied error, could you reshare it or send a copy to ravi.c@example.org
thx!`,
    pastedAt: '2026-11-11T18:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Ravi Chandrasekar',
      contacts: ['ravi.c@example.org'],
      role: 'ML engineer',
      source: null,
      direction: 'in',
      messageAt: null,
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-16-gmail-web-resubmission-same-repo',
    paste: `Re: Senior iOS Engineer - take-home
Inbox

Priya Raman <priya.raman@example.com>
Mon, Nov 16, 8:02 AM (1 day ago)\t
to me

Hi Sam,

Pushed a small fix for the crash on iPad rotation. Same repo (https://github.com/ex-priyar/tidepool-ios), latest commit on main. TestFlight build 1.0.3 has it too.

Looking forward to hearing back!

Priya`,
    pastedAt: '2026-11-17T17:30:00.000Z',
    zone: 'America/Los_Angeles',
    expected: {
      name: 'Priya Raman',
      contacts: ['priya.raman@example.com'],
      role: 'Senior iOS engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-16T16:02:00.000Z',
      links: [{ url: 'https://github.com/ex-priyar/tidepool-ios', kind: 'repo' }],
      deadline: null,
      needsReply: false,
      match: 'h2r-priya-raman',
    },
  },
  {
    id: 'h2-17-imessage-shared-first-name-no-match',
    paste: `Hi Sam! Priya here 👋 the demo is up at priya-checkout-demo.netlify.app, and the write-up is in the same email thread as before. Thank you!`,
    pastedAt: '2026-11-19T19:10:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Priya',
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [{ url: 'https://priya-checkout-demo.netlify.app/', kind: 'submission' }],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-18-gmail-web-withdrawal',
    paste: `Withdrawing my application
Inbox

Oskar Holm <oskar.holm@example.com>
Mon, Nov 2, 6:40 PM (2 days ago)\t
to me

Hi Sam,

I wanted to let you know that I've accepted an offer elsewhere, so I'm withdrawing from the Platform Engineer process. I won't be submitting the take-home. Thank you for your time and for being so responsive throughout. I really enjoyed our conversations.

All the best,
Oskar`,
    pastedAt: '2026-11-05T01:00:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Oskar Holm',
      contacts: ['oskar.holm@example.com'],
      role: 'Platform engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-03T00:40:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-19-linkedin-withdrawal-with-question',
    paste: `TODAY
Grace Okafor sent the following message at 11:26 AM
View Grace’s profile
Grace Okafor
Grace Okafor  11:26 AM
Hi Sam - after a lot of thought I'm going to pull out of the process for the Senior Frontend Engineer role. The timing just isn't right with my current team's launch. Would you be open to keeping me in mind for something in the spring?`,
    pastedAt: '2026-11-17T17:50:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Grace Okafor',
      contacts: [],
      role: 'Senior frontend engineer',
      source: 'linkedin',
      direction: 'in',
      messageAt: '2026-11-17T17:26:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-20-x-dm-extension-request',
    paste: `Yusuf Kaya
@yusufk_builds

yo Sam, family thing came up this week and I'm way behind on the take-home 😬 any chance I could have until monday? totally understand if not
9:47 AM`,
    pastedAt: '2026-11-18T18:15:00.000Z',
    zone: 'America/Los_Angeles',
    expected: {
      name: 'Yusuf Kaya',
      contacts: ['@yusufk_builds'],
      role: null,
      source: 'x',
      direction: 'in',
      messageAt: '2026-11-18T17:47:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-21-apple-mail-calendly-scheduling',
    paste: `From: Leila Ahmadi <leila.ahmadi@example.org>
Subject: Re: Next steps - Data Engineer
Date: November 18, 2026 at 4:05:12 PM CST
To: Sam Ortega <sam.ortega@example.com>

Hi Sam,

Thanks for the kind words about the pipeline project! I'm happy to do the follow-up interview. My availability is pretty tight next week, so here's my calendar, feel free to grab whatever works: calendly.com/ex-leila-ahmadi/45min

Leila Ahmadi
Senior Data Engineer, Quarry Analytics
linkedin.com/in/ex-leila-ahmadi`,
    pastedAt: '2026-11-18T22:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Leila Ahmadi',
      contacts: ['leila.ahmadi@example.org'],
      role: 'Data engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-18T22:05:12.000Z',
      links: [
        { url: 'https://calendly.com/ex-leila-ahmadi/45min', kind: 'other' },
        { url: 'https://linkedin.com/in/ex-leila-ahmadi', kind: 'other' },
      ],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-22-discord-yesterday-question-no-question-mark',
    paste: `Mateo Varga - Yesterday at 10:58 PM
hey Sam, wasn't sure whether you want a hosted version or if a docker compose setup is enough for the review. I have both working locally, just need to know which one to polish`,
    pastedAt: '2026-11-19T14:45:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Mateo Varga',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-19T04:58:00.000Z',
      links: [],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-23-imessage-thanks-after-pass',
    paste: `Thanks Sam, appreciate you letting me know and for the detailed feedback on the caching layer. Makes total sense. Good luck with the search! - bex`,
    pastedAt: '2026-11-20T23:20:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Bex',
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-24-gmail-web-berlin-doc-question',
    paste: `Question about the take-home
Inbox

Elif Aydin <elif.aydin@example.com>
10:12 AM (35 minutes ago)\t
to me

Hi Sam,

I'm reading through the assignment doc (https://docs.google.com/document/d/1exEAydnTakeHomeBrief/edit) and section 3 says the API should be "idempotent", but the sample requests don't include any request id. I wanted to check whether I should add an Idempotency-Key header myself or if you'd rather I dedupe on the payload

Thanks!
Elif

--
Elif Aydin
github.com/ex-elifaydin`,
    pastedAt: '2026-11-23T09:47:00.000Z',
    zone: 'Europe/Berlin',
    expected: {
      name: 'Elif Aydin',
      contacts: ['elif.aydin@example.com'],
      role: null,
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-23T09:12:00.000Z',
      links: [
        { url: 'https://docs.google.com/document/d/1exEAydnTakeHomeBrief/edit', kind: 'doc' },
        { url: 'https://github.com/ex-elifaydin', kind: 'other' },
      ],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
  {
    id: 'h2-25-out-imessage-48-hrs-nickname',
    paste: `Hi Theo! Great talking today. Here's the take-home for the Data Engineer role: https://docs.google.com/document/d/1exTheoPipelineBrief/view

You have 48 hrs from now - just reply here with a repo link when you're done. Good luck!
Sam`,
    pastedAt: '2026-11-03T21:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Theo',
      contacts: [],
      role: 'Data engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [{ url: 'https://docs.google.com/document/d/1exTheoPipelineBrief/view', kind: 'doc' }],
      deadline: '2026-11-05T21:30:00.000Z',
      needsReply: false,
      match: 'h2r-theodore-lindqvist',
    },
  },
  {
    id: 'h2-26-out-gmail-web-sent-due-date',
    paste: `Take-home: Senior Frontend Engineer

Sam Ortega <sam.ortega@example.com>
9:12 AM (0 minutes ago)\t
to Hugo

Hi Hugo,

Thanks again for your time on Tuesday. As discussed, here's the take-home: https://www.notion.so/ex-ortega/Frontend-take-home-3f9a1c0e7b

It's due Nov 20. Aim for 4-6 hours of work. We care more about your decisions than about polish.

Best,
Sam`,
    pastedAt: '2026-11-12T15:12:30.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Hugo',
      contacts: [],
      role: 'Senior frontend engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-11-12T15:12:00.000Z',
      links: [
        { url: 'https://www.notion.so/ex-ortega/Frontend-take-home-3f9a1c0e7b', kind: 'doc' },
      ],
      deadline: '2026-11-21T05:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-27-out-outlook-desktop-thursday-noon-ct-from-la',
    paste: `From: Sam Ortega <sam.ortega@example.com>
Sent: Monday, November 9, 2026 11:30 AM
To: Lena Fischer <lena.fischer@example.org>
Subject: Take-home assignment - Platform Engineer

Hi Lena,

Thanks for making time last week. The take-home is linked below:
<https://docs.google.com/document/d/1exPlatformQueueBrief/edit?usp=sharing>

Please send your repo by Thursday noon CT. Our hiring manager is in Chicago, so we're using Central time for this one.

Best,
Sam Ortega
Recruiting`,
    pastedAt: '2026-11-09T19:34:00.000Z',
    zone: 'America/Los_Angeles',
    expected: {
      name: 'Lena Fischer',
      contacts: ['lena.fischer@example.org'],
      role: 'Platform engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-11-09T19:30:00.000Z',
      links: [
        {
          url: 'https://docs.google.com/document/d/1exPlatformQueueBrief/edit?usp=sharing',
          kind: 'doc',
        },
      ],
      deadline: '2026-11-12T18:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-28-out-slack-eod-monday',
    paste: `Sam Ortega  3:05 PM
hey Farah! thanks for jumping on the call earlier. here's the brief for the Founding Engineer take-home: https://ex-ortega.notion.site/Founding-take-home-brief-8c21
no rush this week, could you get it back to me by EOD Monday? 🙏`,
    pastedAt: '2026-11-12T21:07:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Farah',
      contacts: [],
      role: 'Founding engineer',
      source: 'other',
      direction: 'out',
      messageAt: '2026-11-12T21:05:00.000Z',
      links: [{ url: 'https://ex-ortega.notion.site/Founding-take-home-brief-8c21', kind: 'doc' }],
      deadline: '2026-11-17T05:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-29-out-linkedin-within-3-days',
    paste: `Sam Ortega sent the following message at 10:20 AM
View Sam’s profile
Sam Ortega
Sam Ortega  10:20 AM
Hi Callum, thanks for connecting! Following up on our call, here's the take-home for the Staff ML Engineer role: https://docs.google.com/document/d/1exCallumRankingBrief/edit

Please submit within 3 days. Just reply here with your repo link when it's ready.`,
    pastedAt: '2026-11-10T16:20:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Callum',
      contacts: [],
      role: 'Staff ML engineer',
      source: 'linkedin',
      direction: 'out',
      messageAt: '2026-11-10T16:20:00.000Z',
      links: [
        { url: 'https://docs.google.com/document/d/1exCallumRankingBrief/edit', kind: 'doc' },
      ],
      deadline: '2026-11-13T16:20:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-30-out-imessage-berlin-date-only',
    paste: `Hi Sofia, it was great to meet you at the meetup! As promised, the take-home for the iOS Engineer role is here: https://docs.google.com/document/d/1exSofiaWidgetBrief/edit
Please send it over by Friday, Nov 20. Any questions, just text me.
Sam`,
    pastedAt: '2026-11-16T18:40:00.000Z',
    zone: 'Europe/Berlin',
    expected: {
      name: 'Sofia',
      contacts: [],
      role: 'iOS engineer',
      source: null,
      direction: 'out',
      messageAt: null,
      links: [{ url: 'https://docs.google.com/document/d/1exSofiaWidgetBrief/edit', kind: 'doc' }],
      deadline: '2026-11-20T22:59:59.999Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-31-out-outlook-web-deadline-in-eastern',
    paste: `Take-home - Founding Engineer

Sam Ortega <sam.ortega@example.com>
Tue 11/10/2026 2:18 PM
To: Anika Rao <anika.rao@example.com>

Hi Anika,

Here is the take-home we talked about: https://docs.google.com/document/d/1exAnikaSyncBrief/edit

The deadline is Friday, Nov 13 at 5pm ET. If you need more time, tell me before then and we can figure it out.

Thanks,
Sam`,
    pastedAt: '2026-11-10T20:25:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Anika Rao',
      contacts: ['anika.rao@example.com'],
      role: 'Founding engineer',
      source: 'email',
      direction: 'out',
      messageAt: '2026-11-10T20:18:00.000Z',
      links: [{ url: 'https://docs.google.com/document/d/1exAnikaSyncBrief/edit', kind: 'doc' }],
      deadline: '2026-11-13T22:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-32-out-imessage-scheduling-not-deadline',
    paste: `Hi Marcus, the team loved your submission, especially the load test writeup. Are you free Thursday at 2pm CT for a 45 min walkthrough with our CTO? If not, send me a couple of times that work.
- Sam`,
    pastedAt: '2026-11-11T16:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Marcus',
      contacts: [],
      role: null,
      source: null,
      direction: 'out',
      messageAt: null,
      links: [],
      deadline: null,
      needsReply: false,
      match: 'h2r-marcus-bell',
    },
  },
  {
    id: 'h2-33-out-apple-mail-pass',
    paste: `From: Sam Ortega <sam.ortega@example.com>
Subject: Re: Take-home submission
Date: November 20, 2026 at 3:41:09 PM CST
To: Nikolai Petrov <nikolai.petrov@example.com>

Hi Nikolai,

Thank you for the time you put into the take-home. The team was impressed by the test coverage, but we've decided to move forward with candidates whose experience is closer to our mobile stack. I'm happy to share more detailed feedback on a call if that would help.

Best of luck,
Sam`,
    pastedAt: '2026-11-20T21:50:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Nikolai Petrov',
      contacts: ['nikolai.petrov@example.com'],
      role: null,
      source: 'email',
      direction: 'out',
      messageAt: '2026-11-20T21:41:09.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-34-out-x-dm-extension-granted',
    paste: `Yusuf Kaya
@yusufk_builds

Of course, family comes first. Take until Monday 9am PT, no problem at all. Hope everything is ok!
10:32 AM
Sent`,
    pastedAt: '2026-11-18T18:40:00.000Z',
    zone: 'America/Los_Angeles',
    expected: {
      name: 'Yusuf Kaya',
      contacts: ['@yusufk_builds'],
      role: null,
      source: 'x',
      direction: 'out',
      messageAt: '2026-11-18T18:32:00.000Z',
      links: [],
      deadline: '2026-11-23T17:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-35-out-telegram-72-hours',
    paste: `Sam Ortega, [Nov 16, 2026 at 8:40 AM]:
Hi Zoe! Sending over the Backend Engineer take-home as promised 👉 https://docs.google.com/document/d/1exZoeRateLimiterBrief/edit - you've got 72 hours from now, and a repo link is all I need back`,
    pastedAt: '2026-11-16T14:40:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Zoe',
      contacts: [],
      role: 'Backend engineer',
      source: 'other',
      direction: 'out',
      messageAt: '2026-11-16T14:40:00.000Z',
      links: [
        { url: 'https://docs.google.com/document/d/1exZoeRateLimiterBrief/edit', kind: 'doc' },
      ],
      deadline: '2026-11-19T14:40:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-36-out-discord-starter-repo-pacific-deadline',
    paste: `Sam Ortega - Today at 4:12 PM
Hey Ibrahim, welcome to the take-home channel! The brief is pinned above, and here's the starter repo: https://github.com/ex-ortega-hiring/starter-kit
Deadline is Wednesday 9am PT. Post your repo link here when you're done.`,
    pastedAt: '2026-11-13T22:15:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Ibrahim',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'out',
      messageAt: '2026-11-13T22:12:00.000Z',
      links: [{ url: 'https://github.com/ex-ortega-hiring/starter-kit', kind: 'repo' }],
      deadline: '2026-11-18T17:00:00.000Z',
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-37-whatsapp-confirms-own-date',
    paste: `[8:02 AM, 11/18/2026] Rafael Costa: Morning Sam! Just confirming I'll have the take-home to you by Sunday the 22nd as we discussed. Working on the tests now 💪`,
    pastedAt: '2026-11-18T14:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Rafael Costa',
      contacts: [],
      role: null,
      source: 'other',
      direction: 'in',
      messageAt: '2026-11-18T14:02:00.000Z',
      links: [],
      deadline: null,
      needsReply: false,
      match: null,
    },
  },
  {
    id: 'h2-38-x-dm-handle-case-paren-links-question',
    paste: `Amara Diallo
@AmaraDraws

Hi Sam!! Submitted 🎨 prototype is live (amara-type-scale.vercel.app) and the code's at (github.com/ex-amarad/type-scale). Did you want the Storybook deployed too or is the README enough?
1:05 PM`,
    pastedAt: '2026-11-19T19:30:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Amara Diallo',
      contacts: ['@amaradraws'],
      role: null,
      source: 'x',
      direction: 'in',
      messageAt: '2026-11-19T19:05:00.000Z',
      links: [
        { url: 'https://amara-type-scale.vercel.app/', kind: 'submission' },
        { url: 'https://github.com/ex-amarad/type-scale', kind: 'repo' },
      ],
      deadline: null,
      needsReply: true,
      match: 'h2r-amara-diallo',
    },
  },
  {
    id: 'h2-39-imessage-no-name-link-match',
    paste: `redeployed kat-notes-ex.vercel.app with the sync fix, should be good now. sorry about that!!`,
    pastedAt: '2026-11-21T03:10:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: null,
      contacts: [],
      role: null,
      source: null,
      direction: 'in',
      messageAt: null,
      links: [{ url: 'https://kat-notes-ex.vercel.app/', kind: 'submission' }],
      deadline: null,
      needsReply: false,
      match: 'h2r-katherine-oyelaran',
    },
  },
  {
    id: 'h2-40-outlook-desktop-submission-and-question',
    paste: `From: Ingrid Solberg <ingrid.solberg@example.com>
Sent: Sunday, November 22, 2026 9:14 PM
To: Sam Ortega <sam.ortega@example.com>
Subject: Take home submission + a question

Hi Sam,

Please find my submission for the Full-Stack Engineer take home below.

App: https://shiftboard.example.net/login (test acct: reviewer@example.com / pw in the README)
Code: https://github.com/ex-isolberg/shiftboard
Walkthrough video: https://www.loom.com/share/exa91d7c33f05b

One question - I used Postgres row level security for multi-tenancy instead of the app-level checks the brief sugested. Is that ok or will it be graded against the brief?

Thanks,
Ingrid
555.010.0176`,
    pastedAt: '2026-11-23T14:05:00.000Z',
    zone: 'America/Chicago',
    expected: {
      name: 'Ingrid Solberg',
      contacts: ['ingrid.solberg@example.com', '+15550100176'],
      role: 'Full-stack engineer',
      source: 'email',
      direction: 'in',
      messageAt: '2026-11-23T03:14:00.000Z',
      links: [
        { url: 'https://shiftboard.example.net/login', kind: 'submission' },
        { url: 'https://github.com/ex-isolberg/shiftboard', kind: 'repo' },
        { url: 'https://www.loom.com/share/exa91d7c33f05b', kind: 'submission' },
      ],
      deadline: null,
      needsReply: true,
      match: null,
    },
  },
]
