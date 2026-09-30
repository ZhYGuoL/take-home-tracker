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
5. Apply the rule in D17 to the table it prints. If a model wins, run:
   ```
   npx wrangler secret put OPENROUTER_API_KEY
   npx wrangler secret put MODEL_ID
   ```
   and set `MODEL_ALLOWED_EMAILS` to the recruiter's Google email in `wrangler.jsonc` (see B4).
