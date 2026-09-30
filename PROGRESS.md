# Progress

## M0 Setup - done

- Git repo with `.gitignore` as the first commit.
- `DECISIONS.md` with D1 to D13: hosting, stack, data model, sign-in, dev sign-in, AI, needs reply, deadlines, stages, license, the brief, UI copy, model cost.
- `CLAUDE.md` that points to the brief.
- `features.json` from "Done means".
- Fast check: `pnpm check` (Biome, `tsc -b`, Vitest), about 1 s. A pre-commit hook runs it.
- Full verify: `pnpm verify` (fast check, Playwright on desktop Chromium and iPhone WebKit, production build, production bundle check).
- Reviewer findings fixed: production is now the default build and the only deployable entry, the phone tests run on WebKit, the decisions no longer name the recruiter, and D1, D3, D4, D5, and D9 gained the missing details.
- Open from review: a test that a failing `/api/extract` logs no pasted text (M3 or M4).
- Evidence: `pnpm verify` exit 0 (46 unit tests, 2 e2e tests).
- F11 passes.

## M1 Candidates by hand - done

- Add, edit, and delete a candidate by hand, with deadline presets in the agreed zone and a readout of the deadline in her zone.
- Stages Sent, Submitted, Reviewing, Advanced, Passed.
  A submission link moves Sent to Submitted.
  Opening the submission from the app moves Submitted to Reviewing.
  Advanced and Passed come only from her press on the stage toolbar. Arrow keys move focus but never set a stage.
- Detail drawer (full screen on a phone) with facts, links, notes that save while she types, and a timeline whose entries she can remove.
- Local store in IndexedDB. A failed save does not stop later saves, and the header shows "Not saved" with Retry.
- Reviewer findings fixed: the save queue, deleted data that stayed behind, the +1 phone bug, notes lost on close, two closes after switching rows, presets and zone changes, no way to fix a wrong entry, the link form on a phone, zone label cost, focus in the dialog, stage keys, pink used for errors, rows that jumped, a deadline that moved on edit in a repeated hour, and a silent failure on a cleared time.
- Evidence: `pnpm verify` exit 0 (88 unit tests, 29 e2e tests on desktop Chromium and iPhone WebKit, 3 skipped as desktop-only).
- No `features.json` item flips yet. F3 waits for the paste and model paths (M3, M4).

## M2 Deadlines and attention - done

- Flags: Overdue (deadline passed and the stage is still Sent), Late (first submission after the deadline), Needs reply (the latest message is an inbound one that asks something, with no reply after it).
- Overdue turns on 1 ms after the deadline instant, not on the next 30-second tick. It also updates at once after a deadline edit or a return to the tab.
- "Needs you" is the default view: Submitted, Needs reply, or Overdue, most urgent first.
- Filters by stage, flag, role (including no role), source, date range on four date fields, and text. Each option shows its count. Filters live in the URL. An empty result offers each loosening with the rows it brings back.
- Reviewer findings fixed: Overdue ignored a stage set by hand, same-minute entries sorted at random, Replied could sort before a future-dated question, a bad escape in the URL blanked the page, flags squeezed the name column, popover focus and phone tap-through, an empty date filter, off-by-one presets, empty-state labels, reply sort order, and a pressed color too close to Needs reply blue.
- Evidence:
  - F4: `src/core/flags.test.ts` (exactly at the deadline, one millisecond after, date-only, zones) and `test/e2e/attention.spec.ts` (paused clock at the deadline instant, then +1 ms; viewers in Los Angeles and Tokyo).
  - F5: `src/core/flags.test.ts` needsYou table and `test/e2e/attention.spec.ts` "shows exactly overdue, needs reply, and submitted".
  - F6: `src/core/filters.test.ts` and `test/e2e/filters.spec.ts`, `test/e2e/filters-combined.spec.ts` (each filter alone, and leave-one-out with one decoy per dimension).
  - `pnpm verify` exit 0: 193 unit tests, 100 e2e tests, 4 skipped as desktop-only.
- F4, F5, and F6 pass.

## M3 Paste to add - done

- Add opens on Paste. A paste into the empty box is read at once. The confirm step proposes the candidate (name, role, source, contact, take-home link, deadline) and the message (who wrote it, when, links with kinds, needs reply). She corrects any field before Save.
- A paste that belongs to a known candidate attaches to them (shared contact, own submission or repo link, repo owner, or full name). A first name alone never attaches by default. The attach step shows the contacts it adds.
- A message on the wrong candidate moves in one step, to another candidate or to a new one. What the paste added goes with it, and a candidate that only existed because of it is removed.
- The manual path ("By hand") is unchanged and always there.
- The rules extractor reads Gmail web and app, Outlook, Apple Mail, forwards, LinkedIn, X, Slack, WhatsApp, Telegram, Discord, and plain text, and her own outgoing messages. Zone math moved to `Intl` only (D15).
- Measurement method recorded in D14. The rules' score on the blind set is recorded with M4.
- Reviewer findings fixed: a shared doc link attached new candidates to old ones (blocker), hidden attach side effects, weak matches preselected, durations beating dates, deadlines counted from paste time, missing timestamps guessed as now, Gmail outbound without her identity, Outlook quotes, zones outside the US, and three UI nits.
- Open: the app does not know her name and email until sign-in (M5). Until then, her own messages are recognized by their headers and wording.
- Evidence: `test/e2e/paste.spec.ts` (F1: prefilled name, links, and date, corrected before saving; F2: a second paste attaches), `src/core/paste.test.ts`, `src/core/move.test.ts`, `src/core/extract/*.test.ts`, `eval/*.test.ts`. `pnpm verify` exit 0: 261 unit tests, 118 e2e tests, 4 skipped as desktop-only.
- F1 and F2 pass.

## M4 Model choice - done (model runs blocked on a key, B2)

- Three fictional test sets (D14): a first development set (38), a second one written blind and then used to improve the rules (40), and a blind measurement set written by another agent (40).
- `pnpm eval` scores the rules, each chat model, each merged reading, and Jev (direction, needs reply, match only). Every field is checked on every case, a match counts only if it attaches by default, and a failed or slow model call counts as wrong.
- The rules on the blind set, with her identity: name 88%, contacts 95%, role 100%, source 93%, direction 95%, message time 90%, links 95%, deadline 93%, needs reply 88%, match 88% (D17).
- No `OPENROUTER_API_KEY`, so no model ran. The rules are the reader. D17 has an exact rule for turning a model on, and B2 has the steps.
- The model path is built and tested: structured output, zero-retention endpoints only, only the candidates a paste mentions, a 1,000-token cap, a 12-second timeout, an allowlist and a per-user rate limit in the Worker, and a fallback to the rules on any failure (D6, D13, D16).
- Reviewer findings fixed, including the M3 fixes it also reviewed: the privacy claim (zero retention, not only no training), the whole roster going to the model, model picks that bypassed the first-name rule, deadlines from paste time on the model path, a scorer that inflated numbers, an eval that hid model failures, an Outlook body lost under a subject line, and a one-word name that blocked a match.
- Evidence: F3 in `src/core/derive.test.ts` (500 random automatic histories never reach Advanced or Passed), `src/core/paste.test.ts`, `test/e2e/candidates.spec.ts`, and the model reading, which has no stage field. F9 in `test/e2e/candidates.spec.ts` ("with the model off, adding and advancing a candidate by hand works end to end") and `src/client/lib/extract.test.ts`. `pnpm verify` exit 0: 297 unit tests, 120 e2e tests, 4 skipped as desktop-only.
- F3 and F9 pass.

## M5 Sign-in and isolation, and phone width - done

- Sign-in is Google only, with the code flow and PKCE in the Worker (D4). The session is a sealed, HttpOnly cookie. A signed-out visitor gets the sign-in screen, and every API route refuses them.
- Each person's data lives in a Google Sheet in their own Drive, with the `drive.file` scope. The app sees only files it made, so one user can never read another user's Sheet.
- `pnpm dev` and the tests use a local fake Google with three fictional accounts. The dev entry answers only on localhost, and the production bundle check fails if any dev code reaches it (D5).
- Sync: saves go to an IndexedDB queue first, then to the Sheet. Pulls run on load, focus, and every minute. "Not synced" and Retry show when Google cannot be reached (D18).
- Reviewer findings fixed:
  - Deleting a candidate also deleted a message that was moved off it (blocker). The purge rules are now one pure function, and a tombstone stays so an offline edit cannot bring a candidate back (D3).
  - A save made during a push was never sent, and a pull could hide a save that was just sent.
  - A purge that a closed tab never finished stayed forever. Any device now purges a delete older than 10 minutes.
  - A token that Google refused was never replaced. Sign-out ends every device, and the others now go to sign-in at their next call (D4).
  - Sign-out dropped unsent saves without a word. It now pushes first, and asks if saves are still unsent.
  - A sign-in without Drive access left the app broken. The callback now asks her to continue again with Drive.
  - One oversized row blocked every save after it. Long data now spreads over several cells, and the text boxes have a limit.
  - A hand-edited row with a missing field could blank the app. Rows are now checked field by field.
  - A renamed records tab broke sync, and two first visits at once made two Sheets.
  - The blocker steps could not be followed in order, and one put her email in a public file.
- Also fixed while testing: a date-only deadline showed as 2:59 AM the next morning in another zone, the open detail panel covered "Not synced" and Retry, and the table scrolled sideways by 6 px on a 1280 px screen.
- Evidence:
  - F7: the whole e2e suite runs on the iPhone 15 WebKit profile, and `test/e2e/phone.spec.ts` checks 393, 375, and 320 px, including the sign-in screen.
  - F8: `test/e2e/signin.spec.ts` (a signed-out visitor sees only the way in and the API gives nothing, one user never sees another on the same browser, Drive access), `test/e2e/sync.spec.ts` (sign-out clears the browser), `src/worker/auth.test.ts`, and `src/worker/app.test.ts`.
  - `pnpm verify` exit 0: 349 unit tests, 163 e2e tests, 9 skipped because they apply to only one of the two screen sizes.
- F7 and F8 pass.

## M6 Design and QA - done

- Every "Done means" item that shows in a browser was checked in Aside Browser (real Chrome) at 1440, 390, and 320 px. `docs/qa/` has 31 screenshots, an index that maps each one to F1 to F9, and the scripts that take them again.
- The stylesheet follows the design skill: Geist and Geist Mono, 12px text, the token colors, one 120ms fade-in, hover that changes only color or background, and counts on every filter option.
- Found in the browser and fixed:
  - A date-only deadline showed as 2:59 AM the next day in another zone. It now reads "end of day PDT".
  - The open detail panel covered "Not synced" and Retry. It now starts below the header.
  - The table scrolled sideways by 6 px on a 1280 px screen, and some deadlines wrapped.
  - At 320 px the stage names overlapped, a due time wrapped, and a long link ran past the edge.
  - A chat copied as a name line and a time line lost both. A weekday time, such as "Friday 9:14 AM", is now read too.
  - A message time later than now was saved. Every form now refuses it.
  - Last activity showed when she added a candidate, not what happened.
  - Screen readers read counts as "Sent3", and a match readout lost its value.
- A second review of M5 found concurrent purges that could delete the wrong rows (blocker). A purge now runs alone, under a lock cell in the Sheet (D3). Also fixed from it: a delete on a device that had not pulled, two tracker files after two first visits, a tab renamed while the app is open, sign-out offline, and an emoji split between two cells.
- The M6 review found that the phone screenshots came from a dirty browser, and that some items had no screenshot. Both are fixed, with new screenshots. Its other findings are fixed too: a date-only sent time later than now, focus on the sign-out question, the "Mark replied" label, mono on prose, and checkbox alignment.
- The app has an icon and a web manifest for the phone home screen.
- Evidence: `docs/qa/README.md`. `pnpm verify` exit 0: 365 unit tests, 171 e2e tests, 9 skipped because they apply to only one of the two screen sizes.

## M7 Ship-ready - done, except what waits on Zhiyuan

- `README.md` has three parts: using the app with no setup, running your own copy, and developing it.
  A review checked each step against the app, Google, and Cloudflare, and the steps were fixed.
  For example, Google shows the Drive box unticked, and Node 25 and later no longer include corepack.
- Deploy configuration: `wrangler.jsonc` is the production Worker on the free plan, with nothing that bills.
  `pnpm run deploy` builds, checks that the production bundle has no dev or fake-Google code, and deploys with that config only.
  The dev config has no public address, even if someone deploys it by mistake.
  Nothing is deployed (B4).
- Checked without accounts: a fresh clone installs and runs with `pnpm install` and `pnpm dev`.
  A download with no `.git` folder installs with `npx pnpm@10.18.0 install`.
- The app has an icon and a web manifest for the phone home screen.
- No file in the git history holds a key or a real email.
  The recruiter's first name and one possibly real phone number are in early commits (B1).
- A browser test that reloaded before a save reached the Sheet failed once under load. It now waits for the Sheet.
- F10 stays `false`: only a real deployed copy shows that the README works end to end (B6).
- Evidence: `README.md`, `wrangler.jsonc`, `scripts/check-prod-bundle.ts`, `BLOCKERS.md`.
  `pnpm verify` exit 0: 365 unit tests, 171 e2e tests, 9 skipped because they apply to only one of the two screen sizes.

## What waits on Zhiyuan

Every remaining item is in `BLOCKERS.md`:
- B1 is done: the history no longer holds her name or the possibly real number.
- B2: a model key, to measure the models and maybe turn one on.
- B3: a Google OAuth client, so real sign-in works.
- B4: deploy a copy.
- B5 is done: the repo is public at https://github.com/ZhYGuoL/take-home-tracker.
- B6: check F10 on a real copy, and check sign-in from the iPhone Home Screen.

STATUS: BLOCKED
