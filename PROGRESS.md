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
