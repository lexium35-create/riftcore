# Riftcore

**Riftcore** is an MLBB tournament operator and competition platform.

The repository is the operational home for tournament registration, brackets, match reporting, rules, staff workflows, and the public event experience.

## Current event

**Riftcore — 13 October 2026**

Tournament configuration:

`data/tournaments/2026-10-13-riftcore-open.json`

## What works now

- Responsive public event shell
- Tournament detail page
- Team registration UI
- Server-side roster validation
- Five-starter + optional-substitute enforcement
- Captain validation
- Duplicate MLBB identity detection
- Local development registration persistence
- Match-state transition rules
- Development operator console with registration counts
- Production guard around the unauthenticated operator surface

## Repository structure

```text
riftcore/
├─ apps/
│  └─ web/                 # Public tournament website + operator UI
├─ packages/
│  └─ tournament-core/     # Shared tournament domain rules
├─ data/
│  └─ tournaments/         # Event configuration
├─ docs/
│  ├─ architecture.md
│  ├─ backend-contract.md
│  └─ operations/
└─ .github/
```

## Local development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

The web app runs at `http://localhost:3000`.

Registration data is stored locally in `.riftcore/runtime.json` and is intentionally ignored by Git.

## Important production boundary

The current file storage adapter is **development-only** and refuses writes in production.

Before Riftcore is deployed, the next infrastructure stage must add:

- persistent database storage;
- authenticated operator accounts;
- role-based authorization;
- registration audit history;
- rate limiting / abuse controls;
- production secrets and telemetry.

See `docs/backend-contract.md`.

## Operating principle

Tournament state is structured data first. Public UI, staff UI, brackets, bots, overlays and integrations should consume the same canonical tournament model.
