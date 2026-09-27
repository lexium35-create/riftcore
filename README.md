# Riftcore

**Riftcore** is an MLBB tournament operator and competition platform.

The repository is the operational home for tournament registration, brackets, match reporting, rules, staff workflows, and the public event experience.

## Current event

**Riftcore — 13 October 2026**

The event-specific configuration lives in:

`data/tournaments/2026-10-13-riftcore-open.json`

## Repository structure

```text
riftcore/
├─ apps/
│  └─ web/                 # Public tournament website + operator UI
├─ packages/
│  └─ tournament-core/     # Shared tournament domain types/logic
├─ data/
│  └─ tournaments/         # Event configuration and structured tournament data
├─ docs/
│  ├─ architecture.md
│  └─ operations/          # Rules, registration and tournament-day runbooks
└─ .github/                # Issue templates and repository workflows
```

## Local development

```bash
pnpm install
pnpm dev
```

The web app is available at `http://localhost:3000`.

## Initial product surfaces

- Tournament landing page
- Team/player registration
- Check-in
- Bracket and match schedule
- Lobby assignment
- Match reporting
- Dispute/referee workflow
- Staff operations dashboard
- Results and standings
- Tournament archive

## Operating principle

Tournament state should be structured data first. Public UI, staff UI, brackets, bots, overlays and future integrations should read from the same canonical tournament model.
