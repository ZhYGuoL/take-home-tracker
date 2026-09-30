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
