# Social OAuth

Riftcore supports four social identity providers through Supabase Auth:

- Google
- Discord
- GitHub
- Telegram via a Supabase custom OIDC provider

The login UI is implemented at `/ops/login`.

## Production URLs

Primary application URL:

```text
https://riftcore-five.vercel.app
```

Riftcore callback route after Supabase finishes authentication:

```text
https://riftcore-five.vercel.app/auth/callback?next=/ops
```

Supabase's callback URL — this is the redirect URI registered with Google,
Discord, GitHub and Telegram:

```text
https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
```

The shared Supabase Auth redirect allow-list also keeps the previous Riftcore
Vercel URLs and localhost development URLs because both deployments currently
use the same backend.

## Security model

Authentication and tournament authorization are deliberately separate.

A person can authenticate successfully with any configured identity provider
and still receive **no operator access**. `/ops` requires an active row in
`public.operator_profiles`.

Provider client secrets belong in Supabase/provider dashboards only. Never
commit them to this repository or put them in a `NEXT_PUBLIC_*` environment
variable.

## Google

1. Open Google Auth Platform / Google Cloud Console.
2. Create an OAuth client of type **Web application**.
3. Add this Authorized JavaScript origin:

   ```text
   https://riftcore-five.vercel.app
   ```

4. Add this Authorized redirect URI:

   ```text
   https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
   ```

5. Copy the Client ID and Client Secret.
6. In Supabase: **Authentication → Sign In / Providers → Google**.
7. Enable Google and paste the credentials.

Supabase's standard Google scopes are enough for authentication:
`openid`, email and profile.

## Discord

1. Open the Discord Developer Portal.
2. Create/select the Riftcore application.
3. Under **OAuth2**, add this redirect:

   ```text
   https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
   ```

4. Copy the Client ID and Client Secret.
5. In Supabase: **Authentication → Sign In / Providers → Discord**.
6. Enable Discord and paste the credentials.

Riftcore requests `identify email`.

## GitHub

1. Open GitHub **Settings → Developer settings → OAuth Apps**.
2. Create a new OAuth App.
3. Homepage URL:

   ```text
   https://riftcore-five.vercel.app
   ```

4. Authorization callback URL:

   ```text
   https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
   ```

5. Generate a Client Secret and copy the Client ID + Secret.
6. In Supabase: **Authentication → Sign In / Providers → GitHub**.
7. Enable GitHub and paste the credentials.

Riftcore requests `read:user user:email`. Do not request repository scopes
for simple authentication.

## Telegram

Telegram now supports OpenID Connect. Riftcore uses it through a Supabase
custom provider called:

```text
custom:telegram
```

### Telegram / BotFather

1. Create or select the Riftcore bot in **@BotFather**.
2. Open the bot's **Login Widget** configuration.
3. Add the Riftcore application origin:

   ```text
   https://riftcore-five.vercel.app
   ```

4. Add the Supabase callback URL:

   ```text
   https://mmmfpfnuqqqqfcdqpgvq.supabase.co/auth/v1/callback
   ```

5. Copy the Telegram Login **Client ID** and **Client Secret**.

### Supabase custom OIDC provider

In Supabase, create a new custom provider with these values:

| Field | Value |
| --- | --- |
| Configuration | Auto-discovery / OIDC |
| Identifier | `custom:telegram` |
| Name | `Telegram` |
| Client ID | from BotFather |
| Client Secret | from BotFather |
| Issuer | `https://oauth.telegram.org` |
| Scopes | `openid profile` |
| Email optional | **true** |
| PKCE | enabled |

Telegram does not provide an email address, so **Email optional must be true**.
Do not request the `phone` scope unless Riftcore genuinely needs the user's
phone number.

## Current setup status

The application-side flow and callback are wired for all four providers.

The Supabase Auth site URL is already:

```text
https://riftcore-five.vercel.app
```

Google, Discord, GitHub and Telegram still require their provider credentials
before their buttons can complete a login. Until then, the UI reports that the
provider is wired but not yet enabled rather than silently failing.
