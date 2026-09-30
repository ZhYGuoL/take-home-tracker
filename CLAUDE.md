# take-home-tracker

Read `BRIEF.md` first. It is the product brief: what to build, why, the constraints, and the milestones.
It is a local file and is not in git (see D11 in `DECISIONS.md`).

## Resume from files

If the context is new, read these before you do anything:
1. `PROGRESS.md` for where the work stands.
2. `features.json` for the "Done means" checklist.
3. `BLOCKERS.md` for what waits on Zhiyuan.
4. `DECISIONS.md` for every choice and its reason.
5. `git log --oneline | head -40`.

## Commands

- `pnpm dev` starts the app, the Worker, and a local fake Google (`test/fake-google/server.ts`). Sign in as any of the three fictional people.
- `pnpm demo` fills the fake Google Sheet of Avery Stone with fictional candidates, while `pnpm dev` runs.
- `pnpm eval` measures extraction on the fictional test sets (D14, D17).
- `pnpm run deploy` builds and deploys the production Worker (B4). Never run it without Zhiyuan's OK.
- `pnpm check` is the fast check: lint, typecheck, unit tests. A pre-commit hook runs it.
- `pnpm verify` is the full verify: the fast check, the end-to-end tests, the production build, and the bundle check.
- `docs/qa/` holds the browser screenshots, and `docs/qa/aside/` the Aside scripts that take them again.

## Rules

- In `features.json`, only change the `passes` field. Never delete or reword an item.
- Commits: Conventional Commits, behavior in plain lowercase words, one small verified unit each.
  A test goes in the same commit as the code it covers.
  No amend, rebase, force, remote, or push.
- Use only fictional candidate data. Use `example.com` emails and 555-01xx phone numbers.
- Never log message bodies or pasted text, in the Worker or in the client.
- UI copy: no text that explains the mechanism, no em dashes, no exclamation marks.
  Motion only when the user can name its cause. Hover never reveals content.
- Domain rules live in `src/core` as pure functions with unit tests.
- Sign-out ends the whole Google grant, as at Google. An e2e test that signs out uses Blake or Casey, never Avery, whose session the other tests share.
