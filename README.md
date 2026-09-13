# Calzadilla Live

Calzadilla Media's live baseball scoring and broadcast graphics platform.

## Production application

- `index.html` is the scoring and roster control center.
- `overlay.html` is the broadcast scoreboard overlay.
- The root HTML files remain the production entry points during Phase 2.

The known-working production snapshot is tagged
`production-working-2026-09-13`. Development work belongs on `develop` and
must not be pushed directly to `main` without review.

## Development structure

- `src/` describes the future modular application layout.
- `tests/unit/` captures current intended production behavior.
- `tests/known-bugs/` preserves the 11 audited defect regressions, now passing.
- `tests/browser/` contains isolated Playwright smoke tests.
- `tests/integration/` is reserved for a dedicated non-production Supabase project.
- `.github/workflows/tests.yml` defines the automated test checks.

See [TESTING.md](TESTING.md) for setup, commands and the current baseline.
