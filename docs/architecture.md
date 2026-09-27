# Riftcore architecture

## Goal

Riftcore should not treat a tournament as a collection of unrelated pages. It should treat the tournament as one stateful competitive system.

## Layers

### 1. Public experience

Owned by `apps/web`.

Responsibilities:

- event landing pages
- registration
- brackets and schedules
- live status
- results
- tournament archive

### 2. Tournament domain

Owned by `packages/tournament-core`.

Responsibilities:

- players
- teams
- tournaments
- rounds
- matches
- lobby state
- results
- disputes
- penalties

The domain package must stay UI-agnostic so the same model can later power bots, overlays, admin tools and APIs.

### 3. Event configuration

Owned by `data/tournaments`.

Each tournament gets an explicit configuration file. Unknown decisions remain `null` rather than being silently invented.

### 4. Operations

Owned by `docs/operations`.

This layer contains the human procedures required when software alone is insufficient: lobby handling, no-shows, disputes, evidence collection and result confirmation.

## Near-term backend

The backend is intentionally not locked yet. Before choosing a database/auth stack, define the tournament data model and operator workflow first.
