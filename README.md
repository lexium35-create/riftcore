# Riftcore

**Riftcore** is an MLBB tournament operator and competition platform.

The repository is the operational home for tournament registration, brackets,
match reporting, rules, staff workflows, and the public event experience.

## Current event

**Riftcore — 13 October 2026**

Tournament configuration:

`data/tournaments/2026-10-13-riftcore-open.json`

## Backend

Riftcore is connected to the **Vaelrix / Riftcore Supabase project**.

Current database layer:

- PostgreSQL tournament records
- team registrations
- player rosters
- Row Level Security
- transaction-safe registration RPC
- duplicate MLBB identity protection
- aggregate registration summary RPC
- no service-role secret in the application

The database migration is versioned under `supabase/migrations/`.

## What works now

- Responsive public event shell
- Tournament detail page
- Team registration UI
- Server-side roster validation
- Supabase-backed registration persistence
- Five-starter + optional-substitute enforcement
- Captain validation
- Duplicate MLBB identity detection
- Match-state transition rules
- Development operator console with live Supabase registration counts
- Production guard around the unauthenticated operator surface
- GitHub Actions typecheck + production build verification
- Android/Termux-compatible Next.js Webpack development mode

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app runs at `http://localhost:3000`.

If an older local `.env` already exists, copy the two
`NEXT_PUBLIC_SUPABASE_*` values from `.env.example` into it.

## Important production boundary

The backend is real, but **Riftcore is not production-ready yet**.

Before deployment, the next infrastructure stage should add:

- authenticated operator accounts;
- role-based authorization for staff actions;
- registration review/audit history;
- rate limiting / abuse controls;
- check-in state transitions;
- production telemetry.

See `docs/backend-contract.md`.

## Operating principle

Tournament state is structured data first. Public UI, staff UI, brackets,
bots, overlays and integrations should consume the same canonical tournament
model.
