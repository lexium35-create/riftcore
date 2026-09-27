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
- team registrations and player rosters
- Row Level Security
- transaction-safe public registration RPC
- duplicate MLBB identity protection
- Supabase Auth operator sessions
- owner / admin / referee roles
- authenticated registration review + check-in RPCs
- operator audit trail
- no service-role secret in the application

Database migrations are versioned under `supabase/migrations/`.

## What works now

- Responsive public event shell
- Tournament detail page
- Team registration UI
- Server-side roster validation
- Supabase-backed registration persistence
- Five-starter + optional-substitute enforcement
- Captain validation
- Duplicate MLBB identity detection
- Operator login
- Role-checked registration review
- Verify / reject / reopen workflow
- Verified-team check-in
- Database audit logging
- Match-state transition domain rules
- GitHub Actions typecheck + production build verification
- Android/Termux-compatible Next.js Webpack development mode

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The public app runs at `http://localhost:3000`.

Operator login:

```text
http://localhost:3000/ops/login
```

A Supabase Auth user must also have an active row in
`public.operator_profiles`. See
`docs/operations/operator-access.md`.

## Production boundary

Riftcore is **not deployed** and should remain that way until explicitly
approved.

Before production launch, remaining infrastructure includes:

- operator account provisioning/recovery policy;
- rate limiting / abuse controls;
- bracket generation and seeding;
- match/lobby operations;
- disputes;
- production telemetry.

## Operating principle

Tournament state is structured data first. Public UI, staff UI, brackets,
bots, overlays and integrations should consume the same canonical tournament
model.
