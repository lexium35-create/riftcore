# Backend contract

Riftcore is connected to the **Vaelrix / Riftcore Supabase project**.

## Current registration flow

```text
/register
   ↓
POST /api/tournaments/:slug/register
   ↓
@riftcore/tournament-core validation
   ↓
Supabase publishable client
   ↓
submit_team_registration(...) RPC
   ↓
PostgreSQL transaction
   ├─ tournaments
   ├─ team_registrations
   └─ registration_players
```

## Security boundary

The application does **not** use a Supabase service-role key.

The repository is public, so only Supabase's public project URL and
publishable key are configured in `.env.example`.

All three underlying tables have Row Level Security enabled and direct
`anon` / `authenticated` table access is revoked.

Anonymous application traffic receives only these RPC capabilities:

- `submit_team_registration(...)`
- `get_tournament_registration_summary(...)`

The submission function is `SECURITY DEFINER` and performs the database
write as one transaction.

## Registration invariants enforced in PostgreSQL

- exactly five starters for the current event;
- no more than one substitute;
- exactly one captain;
- captain must be a starter;
- numeric MLBB account ID and server ID;
- no duplicate MLBB identity inside one roster;
- no active duplicate MLBB identity across teams in the same tournament;
- no duplicate active team name in one tournament;
- optional max-team capacity enforcement;
- writes serialized per tournament to prevent registration race conditions.

## Operator data

Captain contact information and roster records are not directly readable
through the publishable key.

The current `/ops` page can retrieve only aggregate registration counts
through a dedicated summary RPC.

Before production deployment, operator authentication and role-based RPCs
must be added for registration review, check-in, seeding, match operations
and disputes.
