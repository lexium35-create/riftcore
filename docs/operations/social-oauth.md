# Social OAuth

Riftcore's staff login supports three Supabase OAuth providers:

- Google
- Discord
- GitHub

The UI is implemented at `/ops/login`.

OAuth returns through:

```text
http://localhost:3000/auth/callback?next=/ops
```

Supabase's provider callback is:

```text
https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
```

## Security model

OAuth authentication and tournament authorization are separate.

A person may authenticate successfully with Google, Discord or GitHub and
still receive **no operator access**. `/ops` requires an active row in
`public.operator_profiles`.

No provider client secret belongs in this repository.

## Provider configuration

For each provider, Supabase needs:

- client ID;
- client secret;
- provider enabled.

The provider developer application itself must allow the Supabase callback:

`https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback`

Do not replace another project's callback URL if that would break its auth.
Create a dedicated Riftcore OAuth app when the provider only supports one
callback.

## Local redirects

The Riftcore Supabase project allowlist includes localhost callback routes for
development. Production URLs must not be added until deployment is explicitly
approved.
