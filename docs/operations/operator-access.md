# Operator access

Riftcore operator tooling uses **Supabase Auth** plus the
`public.operator_profiles` role table.

There is deliberately no public staff signup route.

## Roles

### owner

- full registration review;
- verify, reject and reopen teams;
- check teams in and reverse check-in;
- intended for tournament owners.

### admin

- same current registration permissions as owner;
- intended for trusted tournament operations staff.

### referee

- can read tournament registrations;
- can check verified teams in and reverse check-in;
- cannot approve or reject registrations.

## Provisioning the first operator

1. Create a user in the Riftcore Supabase project's Authentication section.
2. Copy that user's UUID.
3. Insert the role mapping through a trusted database/admin channel:

```sql
insert into public.operator_profiles (user_id, display_name, role)
values ('<AUTH-USER-UUID>', '<DISPLAY-NAME>', 'owner')
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    active = true;
```

Do not build a public "make me admin" endpoint.

## Login

Local route:

```text
http://localhost:3000/ops/login
```

After password authentication, the control room calls
`get_my_operator_profile()`. An authenticated Supabase user without an
active operator profile is denied access.

## Registration operations

The control room uses authenticated RPCs:

- `list_tournament_registrations(...)`
- `set_registration_status(...)`
- `set_registration_check_in(...)`

The browser never gets direct access to the registration tables.

## Audit trail

Every status change and check-in mutation is written to
`operator_audit_log` with:

- acting Supabase user;
- tournament;
- registration;
- action;
- previous state;
- new state;
- timestamp.

This is intentionally database-enforced so UI bugs cannot bypass the audit
trail.
