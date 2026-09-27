# Backend contract

Riftcore is connected to the **Vaelrix / Riftcore Supabase project**.

## Public registration flow

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

## Operator flow

```text
/ops/login
   ↓
Supabase Auth
   ↓
authenticated browser session
   ↓
operator_profiles role check
   ↓
role-scoped RPCs
   ├─ list_tournament_registrations
   ├─ set_registration_status
   └─ set_registration_check_in
   ↓
operator_audit_log
```

## Security boundary

The application does **not** use a Supabase service-role key.

The public repository contains only Supabase's project URL and publishable
key. Those are expected client-side values.

All backend tables have Row Level Security enabled. Direct `anon` and
`authenticated` access to registration/operator tables is revoked.

Public traffic can execute only the registration-submission capability.
Operator RPCs require a Supabase authenticated session and an active
`operator_profiles` row.

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

## Operator invariants

- owner/admin may approve, reject and reopen registrations;
- referee may not alter verification status;
- check-in requires a verified registration;
- leaving verified state automatically clears check-in;
- every operator mutation is stored in `operator_audit_log`.

See `docs/operations/operator-access.md`.
