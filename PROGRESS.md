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
