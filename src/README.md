# Source layout

The production application intentionally remains in the repository root as
`index.html` and `overlay.html` during the regression-baseline phase.

Future implementation work can be introduced here in separate layers:

- `domain/` for pure baseball state transitions and validation
- `data/` for Supabase commands, persistence and generated database types
- `ui/` for control-center and overlay presentation code

Moving production behavior into these layers is deliberately deferred until
the regression suite and known-bug baseline have been reviewed.

