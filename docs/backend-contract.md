# Backend contract

Riftcore now has a working local registration path, but production storage is deliberately not selected yet.

## Current flow

```text
/register
   ↓
POST /api/tournaments/:slug/register
   ↓
@riftcore/tournament-core validation
   ↓
runtime storage adapter
   ↓
.riftcore/runtime.json (development only)
```

## Why the file adapter exists

It allows the registration, validation, duplicate-player detection and operator-count flow to be exercised end to end before a database decision is locked in.

It is **not** production storage.

The file adapter refuses writes when `NODE_ENV=production`.

## Production adapter requirements

The eventual persistent backend must preserve these invariants:

1. A registration has a stable unique ID.
2. A player identity is MLBB account ID + server ID.
3. The same active player identity cannot belong to multiple teams in the same tournament.
4. A registration change must be auditable.
5. Check-in state must be separate from registration verification.
6. Match transitions must be validated by domain rules, not only UI buttons.
7. Staff-only operations require authenticated role checks.
8. Public endpoints must never expose captain contact details or private staff notes.

## Operator console

`/ops` exists for development.

In production it returns a 404 unless `RIFTCORE_ENABLE_UNAUTH_OPS=true`.

That override is for controlled testing only. The intended production design is authenticated operator access.
