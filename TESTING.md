# Testing Calzadilla Live

The test harness executes the existing root `index.html` and `overlay.html`
without changing their production behavior.

- Unit and state-transition tests use JSDOM plus an in-memory Supabase substitute.
- Browser tests intercept the Supabase CDN client and use isolated game data.
- No automated test in this baseline writes to the production Supabase project.

## Requirements

- Node.js 20 or newer
- pnpm 11.19.0 or a compatible pnpm release
- Python 3, used only to serve static files to Playwright

## Install dependencies

```sh
pnpm install
pnpm exec playwright install chromium
```

The repository intentionally excludes `.env` files, `node_modules`, browser
reports, test results and coverage output.

## Supabase environment configuration

The deployed production pages load `config/supabase.production.js`. Localhost
and `file:` pages instead require the generated, gitignored staging
configuration. They do not fall back to production when that file is missing.

Create the local environment file and add the staging publishable/anon key:

```sh
cp .env.example .env
# Edit .env and set SUPABASE_TEST_ANON_KEY.
pnpm run config:staging
```

This generates `config/supabase.staging.generated.js` with permissions limited
to the local user. Both `.env` and the generated JavaScript file are ignored by
Git. Never use a production key or a service-role key in either location.

The generator and integration tests refuse to target any Supabase host other
than the dedicated `awlwuzvcmdgevthoecav` staging project. A hosted develop
preview can select the generated staging configuration with
`?supabase=staging`; the generated file must be supplied by that preview's
deployment process.

## Run tests

Current intended behavior:

```sh
pnpm run test:unit
```

Audited production-bug regressions:

```sh
pnpm run test:known-bugs
```

Isolated browser tests:

```sh
pnpm run test:browser
```

Future Supabase integration tests:

```sh
cp .env.example .env
# Set SUPABASE_TEST_ANON_KEY to the staging publishable/anon key.
pnpm run test:integration
```

Generate the browser configuration and run the integration contract together:

```sh
pnpm run test:staging
```

The integration test is skipped when `SUPABASE_TEST_URL` or
`SUPABASE_TEST_ANON_KEY` is absent. Never place production service-role keys in
this repository or use the production project for destructive tests.

Run every configured test group:

```sh
pnpm run test:all
```

`test:all` runs the complete Vitest suite followed by Playwright. The optional
Supabase contract test is skipped unless dedicated test-project credentials are
configured.

## Current Phase 2 result

Recorded on 2026-09-13 from branch `develop`:

- Original current-behavior unit/state tests: **27 passing**
- Phase 2 safety edge-case tests: **6 passing**
- Audited production-bug regressions: **11 passing**
- Supabase configuration-isolation tests: **3 passing**
- Isolated Playwright browser tests: **3 passing**
- Future Supabase integration tests: **1 skipped** without test-project credentials
- Complete local result: **50 passing, 0 failing, 1 skipped**

All **29 tests that passed before Phase 2** remain green: the original 27 unit
tests and 2 browser tests.

The passing suite covers:

- score, inning/half, balls, strikes, outs, bases and pitch count
- ball, strike, foul, walk, strikeout, HBP, single, double, triple, home run,
  error, fielder's choice, sacrifice fly and double play
- player creation/deletion, 12-hitter limit, position limits, permanent
  substitution, pinch-hit activation and roster persistence after reload
- complete new-game clearing of score, inning/half, count, outs, bases,
  pitchers, pitch counts, events, active players, substitutes and used players
- isolated rendering of the control center and broadcast overlay

## Repaired audited regressions

The original assertions remain in `tests/known-bugs/known-bugs.test.js` and now
pass against the Phase 2 implementation:

1. Edits to two different same-team players both survive roster autosave.
2. A single does not collapse two runners onto third base.
3. An error does not collapse two runners onto third base.
4. A sacrifice fly with two outs does not score a run.
5. Double play is rejected when no runner can be retired.
6. Double play is not recorded with two outs already present.
7. A completed pinch hitter replaces the original batting-order player.
8. Page reload preserves the current batter.
9. Page reload preserves the current plate-appearance pitch sequence.
10. Rapid duplicate actions cannot create duplicate pitch events.
11. Start New Game clears the persisted current-batter fields.

The tests were not weakened, skipped or inverted. Additional tests cover
bases-loaded collision resolution, a legal inning-ending double play, sac-fly
preconditions, plate-appearance reset persistence and rapid duplicate SINGLE
execution.

## Supabase test-project preparation

Before running the integration contract test, apply
`supabase/migrations/202609130001_phase2_game_continuity.sql` to a dedicated
non-production Supabase project. The application code and migration must be
deployed together; the new continuity fields are required for current-batter
and active plate-appearance persistence.
