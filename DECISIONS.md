# Decisions

Each decision has a number, the choice, the reason, and the main alternative that we rejected.
A later decision can replace an earlier one.
The replaced decision then says so.

## D1. Hosting and where the data lives

**Choice.** The app is a static web page plus one small, stateless Cloudflare Worker.
Candidate data lives in a Google Sheet in the user's own Google Drive.
The Worker stores nothing.

**Reason.**
- The data belongs to the recruiter, and this puts it in an account she already controls.
  She can open, export, or delete it without this app.
- The operator of the instance does not store candidate data.
  The operator still runs the code, the Google OAuth client, and the cookie key.
  So a user still has to trust the operator's deploy of this open-source code, as with any hosted app.
- Any recruiter gets a separate copy when they sign in with Google.
  Their data goes to their own Drive.
  Nobody has to deploy anything.
- A recruiter who does not want to trust an operator can run a private instance.
  They fork the repo, deploy it to their own Cloudflare free account, and make their own Google OAuth client.
  The README has the steps.
- Cost is $0.
  The Workers Free plan needs no credit card.
  Over its limit (100,000 requests a day), requests fail.
  It never bills.
  Requests for static files are free and unlimited.
- Cloudflare's terms have no ban on commercial use of the free plan.
  Vercel Hobby does have one, so it is not an option for the recruiter's instance.
- v2 needs Google Calendar.
  The same Google sign-in can ask for that later.
  Calendar read scopes are sensitive, so v2 needs Google's app verification.
  Until then, users see an "unverified app" screen, and Google caps the number of users.
  This is the same cost that counts against Apps Script below, but here only v2 pays it.

**Rejected: a server database (Cloudflare D1, Supabase, or Neon) in the operator's account.**
It is simpler to build, because it has SQL and transactions.
But all recruiters' candidate data would sit in the operator's account.
Also, a second recruiter would need their own deploy and their own Google Cloud setup to get a separate copy.

**Rejected: Google Apps Script bound to a Sheet.**
It also keeps data in her account.
But setup needs the script editor, a deploy step, and an "unverified app" warning.
It also has no good local test story.

## D2. Stack

**Choice.** TypeScript everywhere.
- Client: React 19 and Vite 8.
- Worker: Hono on Cloudflare Workers.
  `@cloudflare/vite-plugin` runs the Worker in `workerd` during development, so dev matches production.
- Domain logic (stages, flags, deadlines, filters, extraction, matching) is pure TypeScript in `src/core`.
  It has no DOM and no network, so unit tests cover it fast.
- Tests: Vitest for units, Playwright for end-to-end.
- Lint and format: Biome.

**Reason.** The product is one signed-in screen with a table, a detail panel, and a paste dialog.
A client app with a thin API is the smallest thing that does it.
Hono is small, typed, and runs the same on Workers and in tests.

**Rejected: Next.js.**
Server rendering adds nothing to a signed-in tool with no public pages.
On Workers it also needs an extra adapter (OpenNext).

## D3. Data model and storage format

**Choice.** Two record types.
- A **candidate** holds profile fields: name, role, source, contacts, deadline, take-home link, and notes.
- An **entry** is one item on a candidate's timeline: a message, a stage change, "opened the submission", or "replied".

One pure function computes the stage, the submission time, and the three flags from the entries.
The app never stores them.

The spreadsheet has two tabs.
- `records` is the store.
  Every save appends a row: `id`, `type`, `updated_at`, `deleted`, `data` (JSON).
  The append uses `insertDataOption=INSERT_ROWS` and `valueInputOption=RAW`, so Sheets never overwrites a row or reads a value as a date.
  The newest row for an id wins.
  The app never edits a row in place.
- `candidates` is a readable view with one row per candidate and plain columns.
  The app rewrites it from the store after each sync.
  Nothing reads it back, so an edit there has no effect, and a lost rewrite only makes it stale until the next one.
- The app finds each tab by its numeric id, which stays the same when she renames a tab.
  Each pull looks the file up again, so a rename while the app is open works at the next pull.
- Two devices can open the app for the first time at once, and each make a file.
  When a device finds more than one tracker file, it copies the rows of the newer files into the oldest, then puts them in the bin with a `mergedInto` mark.
  A device that still wrote to a merged file copies its rows over at its next pull.
  A file that she put in the bin herself has no mark, so the app leaves it alone.

On each sync, the `records` tab is the truth.
Local state is the `records` tab plus the saves on this device that did not upload yet.

When the recruiter deletes a candidate, the app deletes every row with data of that candidate and its entries from `records`.
So the personal data really goes away, and it is not only hidden.
- One tombstone row stays: the id, the type, the time, and no data.
  It stops an older edit from an offline device from bringing the candidate back.
- An entry that she moved to another candidate keeps its newest row.
- A delete sends only the candidate's tombstone, not one per entry.
  A device that has not pulled yet could otherwise hide a message that another device moved away.
  The deleting device forgets the entries at once, so no message text stays on it.
- The device that deletes purges at once, and any device purges what a closed tab left.
- Sheets deletes rows by position, so a purge runs alone.
  One pull runs at a time in a tab, and one purge at a time in a browser.
  Across devices, cell Z1 of `records` is a lock: a find-and-replace of "unlocked" is atomic in Sheets, so only one device takes it.
  A lock older than 2 minutes belonged to a device that stopped, and another device takes it over.
  Under the lock, the purge reads the rows again before it deletes.
- The rules are one pure function, `purgePlan` in `src/core/purge.ts`, which reads only the Sheet rows.

A pasted message, a typed message, and notes are each at most 20,000 characters.
A Sheets cell holds at most 50,000.
JSON can make text up to six times longer, so data longer than one cell goes on in the next cells, up to column Z.
A row that Sheets refuses would stop every save after it, so no row may be too long.

**Reason.**
- If the recruiter moves a wrongly matched message to another candidate, both candidates recompute correctly.
  No stored field can go stale.
- The timeline that the brief asks for is the same data, so there is one source of truth.
- An append with `INSERT_ROWS` adds a new row at the end.
  A phone and a laptop that save at the same time do not overwrite each other.
  Every record has a unique id, so a retried append makes a duplicate that the merge ignores.

**Rejected: a readable sheet with one row per candidate as the store.**
It is what the recruiter would like to see, and the `candidates` tab gives her that view.
As the store it fails, because two devices that edit at the same time rewrite the same row, and the timeline needs a second table anyway.

**Rejected: one JSON file in Drive.**
The Drive API has no conditional update, so two devices that save at the same time lose data.

## D4. Sign-in

**Choice.** Google sign-in, with the OAuth authorization-code flow and PKCE, handled by the Worker.
- Scopes: `openid email profile https://www.googleapis.com/auth/drive.file`.
  `drive.file` is a non-sensitive scope.
  It gives access only to files that this app created.
  Google does not require a security review for it.
- The session is an encrypted, `HttpOnly` cookie that holds the Google refresh token.
  The Worker keeps no session store.
- The browser gets a short-lived access token from `/api/session` and calls the Sheets API directly.
  Candidate data does not go through the Worker.

- Sign-out clears the cookie and revokes the grant at Google.
  Google then refuses every token of this grant, so sign-out ends her sign-in on every device.
  Her other devices go to the sign-in screen at their next call to Google.
  The server keeps no list of sessions, so revoking at Google is the only way to end a copied cookie.
- If Google refuses an access token, the browser asks `/api/session?refresh=1` for a new one.
  If Google also refuses the refresh token, the Worker clears the cookie and she signs in again.
  Saves that did not reach her Sheet stay on the device and go out after she signs in.
- The Google consent screen must be in "In production" status.
  In "Testing" status, only listed test users can sign in, and refresh tokens expire after 7 days.
  With only non-sensitive scopes, Google does not require verification to publish.

**Reason.** No new password, and v2 needs the same Google account for Calendar.
A refresh token keeps her signed in on her phone for months.

**Rejected: browser-only Google sign-in (Google Identity Services token flow).**
It gives no refresh token.
The app would need a Google popup every hour.
iPhone Safari blocks a popup that a tap did not start.

**Rejected: email magic links.**
They need an email sender and a user store, and v2 needs Google anyway.

## D5. No dev-only sign-in in production

**Choice.** There is no special dev login route.
Development and tests use the real OAuth code path against a local fake Google server (`test/fake-google/server.ts`).
It serves the account chooser, the token and revoke endpoints, and the Sheets and Drive calls the app makes, with per-person access.
- The production Worker entry (`src/worker/index.ts`) has the Google endpoints as constants.
- Only the dev entry (`src/worker/dev.ts`) can point at the fake server.
  The dev entry also answers 404 to every host that is not `localhost` or `127.0.0.1`.
- `vite build` makes the production entry by default.
  Only the dev server, preview, and `--mode e2e` use the dev entry.
  Any other mode fails.
- `pnpm run deploy` builds the production entry and deploys it with an explicit config path.
  It does not use the file that the Vite plugin writes after each build, which can point at the last e2e build.
- `scripts/check-prod-bundle.ts` runs at the end of `pnpm verify` and before every deploy.
  It fails if the production bundle contains the dev entry marker or a fake Google reference.
  It also fails if a plain `wrangler deploy` would deploy anything other than the production build.

**Reason.** The brief requires that nobody can turn on a dev sign-in in production.
Here there is nothing to turn on, and tests still exercise the real sign-in code.

**Rejected: a `/auth/dev-login` route behind an environment flag.**
A wrong flag in production would open every account.

## D6. AI approach

**Choice.** Rules first.
A model is optional.
- A deterministic extractor always runs in the browser.
  It finds links, dates, deadlines like "48 hours", email headers, signatures, greetings, and handles.
- When a model key exists, the Worker route `/api/extract` asks a model for a better proposal.
  The client merges the two.
  The recruiter confirms every field before anything saves.
- Without a key, or when the model fails or is slow, the client uses the rules proposal.
  Nothing else changes.
- Provider: OpenRouter as one gateway, so one key can reach every model under test.
  OpenRouter itself does not store prompts or train on them unless the account opts in.
  Requests set `provider.zdr: true`, so OpenRouter routes only to endpoints with zero data retention.
  They also set `provider.data_collection: "deny"`, which excludes providers that train on requests.
  `data_collection` alone is not enough, because some providers that do not train still keep requests for a while.
  If no zero-retention endpoint serves a model, the call fails, and that model cannot win in M4.
- What goes to the model: the paste, her name and email, and only the known candidates that the paste mentions by a name word, contact, or link.
  The rest of her pipeline never leaves her browser.
- The model never sets a stage and never judges a candidate.
- M4 measures the models and Jev.
  A later decision records the numbers.

**Reason.** The brief requires that everything works by hand when the model is off.
Rules also answer instantly, which matters on a phone.

**Rejected: model-only extraction.**
It adds a network wait to every paste and fails completely when the key is missing.

## D7. What "Needs reply" means

**Choice.** Each inbound message has a `needsReply` value.
The extractor (rules or model) proposes it, and the recruiter can change it in the confirm step.
The flag is on when all of these are true:
- The latest message from or to the candidate is inbound.
- That message has `needsReply` on.
- No "replied" mark or outbound message comes after it.

**Reason.** "Here is my submission, thanks" does not need a reply.
The Submitted stage already puts it in front of her.
"Can I use Supabase?" does need a reply.
Only the content can tell them apart, so she has the final word.

## D8. Deadlines and time zones

**Choice.**
- A deadline is an exact instant plus the time zone of the agreement (an IANA name such as `America/New_York`).
- A submission at or before the deadline instant is on time.
  Only a submission after it is Late.
- A date with no time means the end of that day, 23:59:59.999, in the agreed zone.
- "48 hours" adds exactly 48 real hours.
  "2 days" adds two calendar days at the same wall-clock time in the agreed zone.
  These differ by one hour across a daylight-saving change.
- Late uses the first submission.
  A later fix after the deadline does not make an on-time submission late.
  The first submission is the first inbound submission or repo link, or the first time she sets Submitted or Reviewing by hand.
  The second case covers work that came in without a link, such as a zip file.
- Overdue means: the deadline has passed and the stage is still Sent.
  Once work comes in, by link or by her hand, the candidate is not overdue.
- The UI shows times in the recruiter's own time zone.
  The detail view also shows the agreed zone.

**Reason.** Candidates and the recruiter are often in different zones.
An instant makes the flag math exact.
The zone keeps what the two people actually agreed.

**Rejected: a local date and time string.**
It is ambiguous across zones and daylight-saving changes.

## D9. Stages

**Choice.** The stages are Sent, Submitted, Reviewing, Advanced, and Passed.
- Automatic changes only move forward, and only through Sent, Submitted, and Reviewing.
  A submission link moves Sent to Submitted.
  When the recruiter opens the submission from the app, Submitted moves to Reviewing.
- Only a stage entry from a click by the recruiter can make Advanced or Passed.
  No paste, model output, or automatic rule can make one.
- Automatic changes never touch an Advanced or Passed candidate.
- The recruiter can set any stage by hand, including an earlier one.
- One exception to "only forward": the stage comes from the entries (D3).
  If the recruiter moves the only submission message to another candidate, the first candidate goes back to Sent.
  This is correct, because that candidate never submitted.

**"Needs you"** shows a candidate when one of these is true:
- The stage is Submitted.
- Needs reply is on.
- Overdue is on.

## D10. License

**Choice.** MIT.
It is permissive and the most common license for small web tools.

**Rejected: Apache-2.0.**
Its patent terms add nothing for this project, and it is longer to read.

## D11. The brief stays out of git

**Choice.** `BRIEF.md` is in `.gitignore`.
`CLAUDE.md` points to it as a local file.

**Reason.** The brief quotes private messages from a real person, and this repo will become public.
If the brief never enters git, no history rewrite is necessary later.

## D12. UI copy rules when the design skill and the UI standards disagree

**Choice.** Zhiyuan's UI standards win over the `mal-gg-design` skill on copy.
The skill's empty state has a sentence that explains filter logic.
The UI standards ban text that explains the mechanism.
So an empty state names the state and gives escape hatches with row counts, and no explanation.
The app is light mode only, as the skill says.

**Reason.** The UI standards are Zhiyuan's own rules.
The skill is an extracted snapshot of another site.

## D13. Model cost guard

**Choice.** Three limits on model spend.
- `/api/extract` requires a signed-in session.
- It also requires the user's email to be in `MODEL_ALLOWED_EMAILS`.
  It is a Worker secret, not a var in `wrangler.jsonc`, so no real email is in the public repo.
  If the list is empty, the model is off for everyone, and the rules proposal is used.
  Other users of the same instance still get the full app without the model.
- The OpenRouter key has a monthly credit limit, which the operator sets in OpenRouter.
  That is the hard cap, because the Worker has no daily counter.

A Workers rate-limit binding also caps each user at 20 model calls a minute.
It stops a stuck client from a loop of calls.
The binding only has 10 and 60 second windows, so it cannot be a daily cap.

**Reason.** OpenRouter needs prepaid credits, which needs a card, so the operator pays for every paste.
An allowlist keeps a shared instance from spending the operator's credits on strangers.

**Rejected: a daily counter in Workers KV or a Durable Object.**
It adds stored state to a Worker that has none, for a limit that the OpenRouter key already enforces.

## D14. How extraction is measured

**Choice.** Three fictional test sets, with different jobs.
- `eval/cases.ts` (38 cases) is the first development set.
  The rules were written while reading it, so it only guards against regressions.
- `eval/holdout.ts` (40 cases) was written blind by a separate agent.
  Its first run measured the first rules: name 14 of 39, source 10 of 32, message time 7 of 31.
  It then became the second development set, to improve the rules on real copy formats.
- `eval/holdout2.ts` (40 cases) was written blind by another agent, after the rules stopped changing for it.
  Every accuracy number in this file comes from it.

A case checks only the fields that the paste states, plus the fields where "nothing" is the right answer: no links, no deadline, no match, no reply needed.

**Reason.** A score on the set that shaped the rules says little.
A blind set is the closest thing to real pastes that the run can make without real data.

**Rejected: one set for both.**
The rules scored 37 of 38 on direction and every other field correct on the development set, which is not a believable accuracy.

## D15. Zone math uses Intl only

**Choice.** `src/core/zone.ts` converts between instants and wall clocks with `Intl.DateTimeFormat` only.
It never subclasses `Date` and never reads the machine's zone.
- In the hour that clocks skip, a time moves forward by the skipped length.
- In the hour that repeats, a time means the first of the two instants.
- Unit tests run with the system zone set to `Pacific/Chatham` (+12:45, with daylight saving), so code that leans on the machine zone fails.

**Reason.** The first version used `@date-fns/tz`, which subclasses `Date`.
Under a test clock that replaces `Date`, it read "5pm ET" as 2 PM.
The unit tests passed only because this Mac is in New York.

**Rejected: keep `@date-fns/tz` and avoid the test clock.**
The bug class would stay, and deadline boundary tests need a controlled clock.

## D16. How the model reads a paste

**Choice.** The model reads meaning. Code does everything exact.
- The model returns a JSON reading with a fixed schema (structured output): the candidate's name and contacts, role, source, direction, whether she needs to reply, which known candidate it is, the links with their kinds, and two copied phrases: the message's timestamp and her deadline phrase.
- Code reads those two phrases with the same date reader the rules use (`when.ts`), in her zone.
  The model never computes a date or an offset.
- Code drops any link, contact, timestamp, or candidate id that is not in the paste or the known list.
  A name or role counts only if every word of it is in the paste.
  An invented value cannot reach her.
- A candidate the model picks is a strong match only if the paste shares evidence with that candidate: a contact, a link, a repo owner, or the full name.
  Otherwise it is weak, like a first-name match from the rules, and it does not attach by default.
- The client merges the two readings.
  The model decides name, role, source, direction, and reply.
  A strong rules match wins over the model's pick.
  The rules keep link addresses and contacts, and their times and deadlines win when they read one, because they see the day lines that a copied time loses.
  A deadline like "48 hours" counts from when her message was sent.
- If the model is off, slow (12 s), or fails, the rules reading is used, and she sees no difference except the fields.
- Errors carry only a failure kind and a status code, never text from the paste or the reply.

**Reason.** Language models are good at "who wrote this and what do they want" and bad at time zone arithmetic.
This split uses each side for what it does well, and every exact value stays testable.

**Rejected: let the model return ISO timestamps.**
It would have to know her zone, daylight saving, and "yesterday" relative to the paste, and a wrong answer looks right.

## D17. Model choice

**Measured.** The rules on the blind set (`pnpm eval --set blind`, 40 cases, D14).
Every field is checked on every case: a proposal that fills a field the paste does not state is wrong.
"match" counts only a match that attaches by default. "suggest" counts the candidate listed first.

| Field | With her name and email | Without them |
|---|---|---|
| name | 88% (35/40) | 78% (31/40) |
| contacts (exact set) | 95% (38/40) | 90% (36/40) |
| role | 100% (40/40) | 100% (40/40) |
| source | 93% (37/40) | 93% (37/40) |
| direction | 95% (38/40) | 85% (34/40) |
| message time | 90% (36/40) | 90% (36/40) |
| links | 95% (38/40) | 95% (38/40) |
| deadline | 93% (37/40) | 85% (34/40) |
| needs reply | 88% (35/40) | 85% (34/40) |
| match (attaches) | 88% (35/40) | 88% (35/40) |
| suggest (listed first) | 95% (38/40) | 95% (38/40) |

The app knows her name and email once she signs in (M5), so the first column is what she gets.
For comparison, the first rules scored 36% on name, 31% on source, and 23% on message time on a blind set, under a looser scorer.

**Not measured yet.** The run had no `OPENROUTER_API_KEY` in `.env`, so no model ran (B2).
`pnpm eval --set blind --jev` measures these, chosen for low cost and structured output support on OpenRouter:

| Model | $ per 1M in / out | Estimated $ per paste |
|---|---|---|
| `openai/gpt-5.4-nano` | 0.20 / 1.25 | 0.0005 |
| `google/gemini-3.1-flash-lite` | 0.25 / 1.50 | 0.0006 |
| `deepseek/deepseek-v4-flash` | 0.14 / 0.28 | 0.0003 |
| `anthropic/claude-haiku-4.5` | 1.00 / 5.00 | 0.0023 |
| `jev-1.13` (direction, needs reply, match only) | 0.042 / free | under 0.0001 |

The estimate assumes about 1,500 input tokens and 150 output tokens.
Each request caps output at 1,000 tokens, which also bounds a reasoning model.
At 20 pastes a day, every option costs under $0.05 a day.

**Choice.** The rules are the reader until a model beats them.
The model stays off: the Worker needs both `OPENROUTER_API_KEY` and `MODEL_ID`, and `MODEL_ID` is unset.

**Rule for turning it on.** Run `pnpm eval --set blind --jev`. The run uses the app's 12-second limit, and a failed or slow call counts as wrong. Then:
1. Take the merged reading ("rules + model") of each chat model.
2. Keep a model only if, over name, message time, needs reply, and match together, it gets at least 4 more cases right than the rules.
   It must also not lose more than 1 case on any other field, and it must have no errors.
3. Of the models kept, pick the cheapest one within 2 cases of the best total.
4. Use Jev only if "rules + jev" gets more cases right than both the rules and the picked model on direction, needs reply, and match, with no errors.
   Its requests demand zero retention too. If TypeSafe cannot serve that, every call fails and Jev is out.
   Otherwise leave Jev out, because the brief says not to force it.
5. Record the table as a new decision, and set `MODEL_ID`.

**Reason.** The brief says to measure, not assume.
On 40 cases, one case is 2.5 points, so the rule counts cases, not percentages.
Until a model beats the rules on the blind set, adding one costs money and a network wait for no known gain.

## D18. How the browser and her Sheet stay in step

**Choice.**
- The browser keeps two things in IndexedDB, under her Google account id: a copy of her records, and a queue of saves that have not reached the Sheet.
- A save goes into the queue first, then the app appends it to the Sheet. A closed tab or a dropped connection loses nothing.
- If Google cannot be reached, the header says "Not synced" with Retry. The saves stay in the queue and go out on the next try.
- A pull reads the whole `records` tab. The Sheet is the truth, plus whatever is still in the queue.
  The app pulls on load, when she returns to the tab, when the window gets focus, and each minute while the tab is visible.
- Deleting a candidate appends the delete, then deletes every row of that candidate and its entries from the Sheet.
  Other devices drop the candidate on their next pull.
- The app finds her Sheet by a Drive label (`appProperties`). It also looks for an unlabeled file with the tracker's name, so a setup that failed halfway never leaves a second Sheet.
- The readable `candidates` tab is rewritten at most once every 20 seconds after a change.
- Signing out revokes the Google grant, clears the cookie, and deletes her copy and queue from this browser.

**Reason.** She uses a phone and a laptop, sometimes on a bad connection.
A queue with a truth-on-pull rule is simple, never overwrites another device's rows, and makes deletes real.

**Rejected: write through to the Sheet on every change, with no local copy.**
Every screen would wait on Google, and a dropped connection would lose the change.
