# Blockers

Each item is something only Zhiyuan can do.
Each item says what is missing, why it matters, and the exact steps.

## B1. Decide about two early commits before the repo goes public

**What.** Commit `c85b5fc` ("docs: record D1 to D12") has two lines that later commits removed:
- the recruiter's first name,
- one personal sentence.

Later commits removed both lines from the files.
They are still in the git history, and the unattended run may not rewrite history.

**Why it matters.** Anyone can read the full history of a public repo.

**Steps.** Pick one before the first push:
1. If both lines are fine to publish, do nothing.
2. If not, publish a new history with one commit:
   ```
   git branch -m main history
   git checkout --orphan main
   git commit -m "initial public release"
   ```
   Push only `main`.
   The full history stays on the local `history` branch.

## B2. A model key, to measure the models and maybe turn one on

**What.** `.env` has no `OPENROUTER_API_KEY`, so the model comparison in M4 could not run (D17).
The app works fully without it. The rules read every paste.

**Why it matters.** The rules miss about 1 in 8 names, message times, and reply flags on the blind set.
A model may close that gap for well under $0.05 a day.
OpenRouter needs prepaid credits, which needs a card, so this needs your OK.

**Steps.**
1. At openrouter.ai, open Settings, then Keys, and create a key named `take-home-tracker` with a credit limit of $5.
2. In Settings, then Privacy, make sure "Enable training and logging" is off for your account.
3. Put the key in `take-home-tracker/.env` as `OPENROUTER_API_KEY=...`.
4. Run `pnpm eval --set blind --jev`.
5. Apply the rule in D17 to the table it prints.
6. If a model wins, and after B4, set three secrets on the deployed Worker:
   ```
   npx wrangler secret put OPENROUTER_API_KEY --name take-home-tracker
   npx wrangler secret put MODEL_ID --name take-home-tracker
   npx wrangler secret put MODEL_ALLOWED_EMAILS --name take-home-tracker
   ```
   For `MODEL_ID`, paste the winning model id.
   For `MODEL_ALLOWED_EMAILS`, paste the recruiter's Google email.
   It is a secret, so her email never goes into the public repo.

## B3. A Google OAuth client, so real sign-in works

**What.** Sign-in needs a Google OAuth client ID and secret. The run could not create one, because it may not create accounts or projects.
Until then, `pnpm dev` and the tests use a local fake Google, and a deployed copy shows "Sign-in is not set up on this server."

**Why it matters.** Without it, nobody can sign in to a deployed copy.

**Steps.** None of this needs billing.
1. At console.cloud.google.com, create a project named `take-home-tracker`.
2. In APIs and Services, then Library, turn on "Google Sheets API" and "Google Drive API".
3. In Google Auth Platform, set up the consent screen:
   - App name `Take-homes`, your email as the support and developer contact.
   - Audience: External.
   - Data access: add only `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `.../auth/drive.file`.
4. Publish the app, so its status is "In production" (D4).
   With only these scopes, Google does not ask for verification.
   In "Testing" status, only listed test users can sign in, and every sign-in ends after 7 days.
5. In Clients, create an OAuth client of type "Web application".
   For now, add only this authorized redirect URI, to try real Google locally:
   `http://localhost:5173/auth/google/callback`.
   B4 adds the web address after the first deploy, because it does not exist before.
6. Keep the client ID and secret for B4, step 4.

## B4. Deploy a copy (needs B3)

**What.** Nothing is deployed. The run may not deploy.

**Why it matters.** The recruiter can only use a copy on the web.

**Steps.**
1. Create a free Cloudflare account. It needs no card, and the free plan fails instead of billing (D1).
2. In this folder, run `npx wrangler login`.
3. Run `pnpm run deploy`. It builds, checks the production bundle (D5), and prints the `workers.dev` address.
4. Set the three secrets. Run each command and paste the value when asked:
   ```
   npx wrangler secret put GOOGLE_CLIENT_ID --name take-home-tracker
   npx wrangler secret put GOOGLE_CLIENT_SECRET --name take-home-tracker
   npx wrangler secret put SESSION_SECRET --name take-home-tracker
   ```
   For `SESSION_SECRET`, paste the output of `openssl rand -base64 48`.
   Always give `--name take-home-tracker`.
   Without it, wrangler can pick the test Worker that `pnpm e2e` configures.
5. At console.cloud.google.com, open the OAuth client from B3.
   Add the authorized redirect URI `https://<the address from step 3>/auth/google/callback`, and save.
6. Open the address, sign in with your own Google account, and add a test candidate.
   Check that a Sheet named "Take-home tracker" appears in your Google Drive.
7. Send the address to the recruiter yourself. The run never contacts her.
8. Optional, only after B2: set the three model secrets in B2, step 6.
   The secrets take effect at once, with no new deploy.

## B5. A public GitHub repo (after B1)

**What.** The repo has no remote, and nothing is pushed. The run may not create either.

**Steps.**
1. Decide B1 first.
2. Create an empty repo under `ZhYGuoL`, for example `take-home-tracker`.
3. `git remote add origin git@github.com:ZhYGuoL/take-home-tracker.git`
4. `git push -u origin main`
