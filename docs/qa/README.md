# Browser QA

This folder shows each "Done means" item of the brief in a real browser.
The screenshots come from Aside Browser (real Chrome) on 2026-09-30, with the app from `pnpm dev`.
The browser was in `America/New_York`.
All candidates, emails, and links are fictional.

Desktop screenshots are 1440 px wide.
Phone screenshots are 390 px or 320 px wide, saved at 2x.
Every item also has automated tests, which run in `pnpm verify` on desktop Chromium and on iPhone 15 WebKit.

## F1. Paste to add

A pasted email from a new person proposes the name, role, source, contact, message time, and links.
She can change any field before she saves.

- `f1-01-add-paste-1440.png`: Add opens on Paste.
- `f1-02-paste-proposes-new-1440.png`: the proposal for "Theo Marsh", with his email as the contact.
- `f1-03-paste-message-and-correction-1440.png`: further down, the message time and the two links with their kinds. She changed the role before this shot.
- `f1-04-saved-detail-1440.png`: after Save, the candidate is Submitted, with the corrected role, the links, and the message time from the email.
- Tests: `test/e2e/paste.spec.ts`, `src/core/paste.test.ts`, `src/core/extract/*.test.ts`.

## F2. A second paste attaches

A chat from "Priya Raman" matches the candidate with that full name.

- `f2-01-paste-attaches-1440.png`: "Attach to" is Priya Raman, and the confirm step says what matched.
- `f2-02-attached-detail-1440.png`: the message is on her timeline, and she is Submitted.
- Tests: `test/e2e/paste.spec.ts` ("a second paste from the same candidate attaches to her").

## F3. Advanced and Passed only by her click

- `f3-01-submitted-before-click-1440.png`: Diego Alvarez is Submitted.
- `f3-02-advanced-after-click-1440.png`: after a click on Advanced, the timeline shows "Stage set to Advanced".
- Tests: `src/core/derive.test.ts` (500 random automatic histories never reach Advanced or Passed), `test/e2e/candidates.spec.ts`.

## F4. Overdue and Late

- `f4-01-all-flags-1440.png`: Omar Haddad is Overdue. His date-only deadline shows as "end of day PDT", because it was agreed in Los Angeles.
- `f4-02-late-detail-1440.png`: Mei Tanaka submitted after her deadline, which was agreed in Tokyo. The detail shows the deadline in both zones.
- Tests: `src/core/flags.test.ts` and `test/e2e/attention.spec.ts` (exactly at the deadline, one millisecond after, and viewers in three zones).

## F5. Needs you

- `f5-01-needs-you-1440.png`: the default view shows the overdue, the unanswered, and the submitted candidates, most urgent first.
- Tests: `src/core/flags.test.ts` and `test/e2e/attention.spec.ts`.

## F6. Filters

- `f6-01-stage-filter-counts-1440.png`: each option shows how many candidates it would show.
- `f6-02-stage-and-flag-1440.png`: Stage and Flag together. Each active filter takes the color of what it filters.
- `f6-03-no-match-ways-back-1440.png`: when nothing matches, each way back shows how many candidates it would bring back.
- `f6-04-role-filter-1440.png` and `f6-05-date-filter-1440.png`: the Role and Date filters.
- Tests: `src/core/filters.test.ts`, `test/e2e/filters.spec.ts`, and `test/e2e/filters-combined.spec.ts`.

## F7. Phone width

- `f7-01-needs-you-390.png` and `f7-02-all-390.png`: a list instead of the table.
- `f7-03-filter-sheet-390.png`: filters open as a sheet from the bottom.
- `f7-04-detail-390.png`: the detail fills the screen.
- `f7-05-paste-confirm-390.png`: the paste confirm step.
- `f7-06-all-320.png` and `f7-07-detail-320.png`: the narrowest phones. The five stage names fit, and nothing scrolls sideways.
- Tests: every e2e test also runs on iPhone 15 WebKit. `test/e2e/phone.spec.ts` checks 393, 375, and 320 px.

## F8. Signed out, and one user per Sheet

- `f8-01-signed-out-1440.png` and `f8-04-signed-out-390.png`: a signed-out visitor sees only "Continue with Google".
- `f8-02-google-chooser-1440.png`: the local fake Google account chooser. `pnpm dev` uses it, and the production build cannot contain it (D5).
- `f8-03-other-person-empty-1440.png`: a second person signs in on the same browser and sees an empty list of their own.
- Tests: `test/e2e/signin.spec.ts` (the API gives a signed-out visitor nothing, and one user never sees another on the same browser), `test/e2e/sync.spec.ts`, `src/worker/auth.test.ts`, and `src/worker/app.test.ts`.

## F9. By hand, with the model off

- `f9-01-by-hand-1440.png`: the manual form. The model is off in this run, because there is no key (B2).
- `f9-02-by-hand-saved-1440.png`: the candidate saved by hand, with a 48-hour deadline.
- Tests: `test/e2e/candidates.spec.ts` ("with the model off, adding and advancing a candidate by hand works end to end").

## Sync

- `sync-01-not-synced-panel-open-1440.png`: Google refused the save, so the header shows "Not synced" and Retry, even with a candidate open.
- `sync-02-sign-out-asks-1440.png`: with a save that did not reach her Sheet, sign-out asks first.
- Tests: `test/e2e/sync.spec.ts` and `src/client/sync/*.test.ts`.

## Run it again

1. Open Aside Browser.
2. Run `docs/qa/aside/up.sh`. It starts the fake Google and the app, and adds the demo candidates.
3. Run each script: `aside repl "$(cat docs/qa/aside/lib.js docs/qa/aside/desktop-1.js)"`, then `desktop-2.js`, then `phone.js`.
   Run `up.sh` again before `phone.js`, because `desktop-2.js` changes the demo data and makes the fake Google refuse saves.
   `desktop-2.js` ends with a sign-out, so the browser keeps nothing for the next run.
4. Run `docs/qa/aside/pull.sh`. It moves the new screenshots into this folder.
