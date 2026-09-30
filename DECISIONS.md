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

On each sync, the `records` tab is the truth.
Local state is the `records` tab plus the saves on this device that did not upload yet.

When the recruiter deletes a candidate, the app deletes every row of that candidate and its entries from `records`.
So the personal data really goes away, and it is not only hidden.

A pasted message is at most 20,000 characters.
A Sheets cell holds at most 50,000.

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

- Sign-out clears the cookie and revokes the refresh token at Google.
  The server keeps no list of sessions, so revoking at Google is the only way to end a copied cookie.
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
Development and tests use the real OAuth code path against a local fake Google server (`test/fake-google`, planned for M5).
- The production Worker entry (`src/worker/index.ts`) has the Google endpoints as constants.
- Only the dev entry (`src/worker/dev.ts`) can point at the fake server.
  The dev entry also answers 404 to every host that is not `localhost` or `127.0.0.1`.
- `vite build` makes the production entry by default.
  Only the dev server, preview, and `--mode e2e` use the dev entry.
  Any other mode fails.
- `pnpm deploy` builds the production entry and deploys it with an explicit config path.
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
  OpenRouter does not store or train on API data by default.
  Requests also set `provider.data_collection: "deny"`, so OpenRouter routes only to providers that do not store data.
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
- Overdue means: the deadline has passed, there is no submission, and the stage is not Advanced or Passed.
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
