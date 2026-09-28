# Authentication and sessions

The API starts login at `GET /api/auth/steam`. It creates a random login state in the Redis-backed anonymous session and includes that value in the OpenID `return_to`. The callback uses the same server-side session, requires the matching state, and asks `node-openid` to verify the assertion with Steam using provider-side `check_authentication` (stateless mode, so verification works across API replicas). The only accepted identity is an HTTPS Steam claimed identifier with a 17-digit SteamID64. No user row is created before this verification succeeds.

SteamID64 is persisted as a decimal string. accountId32 is computed using BigInt subtraction from Steam's public base ID and checked against the unsigned 32-bit range. Prisma's unique SteamID64 and accountId32 constraints protect concurrent first logins. The user upsert updates only supplied display name and trusted Steam avatar URL fields; the role is assigned as USER for new accounts and never copied from callback data. Profile summaries are fetched server-to-server only when `STEAM_API_KEY` is configured; otherwise the SteamID64 is used as the initial display name.

The authenticated session stores only the user ID. Redis is required outside test mode; startup fails if Redis cannot connect. Session cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after `SESSION_MAX_AGE_MS` (7 days by default). Cookie name, path, and optional domain are configurable. Session identifiers rotate before login state is saved and again after successful authentication. `/api/me` resolves the user from the database on each request and returns a restricted public DTO. `POST /api/auth/logout` destroys the server-side session and clears the cookie; repeating it is safe.

## CSRF model

The intended deployment serves the SPA and API from the same site (in production, normally one reverse-proxy origin). SameSite=Lax prevents browsers from sending the session cookie on cross-site state-changing requests. In addition, middleware requires an exact `Origin` match to the configured `APP_URL` for every POST, PUT, PATCH, or DELETE request, including logout. The OpenID callback is a top-level GET and changes login state only after validating the one-time state stored in the user's current server-side session. No state-changing GET routes are defined. If deployment later places the UI and API on different sites, the cookie and CSRF policy must be redesigned together; do not weaken the Origin check to accommodate it.

The role guard reads the role from the database-backed current user. It supports USER and ADMIN and does not rely on client state. No admin endpoints are included.

## Frontend integration contract

- Navigate the browser to `GET /api/auth/steam` to begin login.
- The API redirects to the Steam OpenID page and then back to the configured `APP_URL` after success. On a failed/cancelled login it redirects to that same configured URL with `steamAuth=failed`.
- Call `GET /api/me` with same-origin credentials to retrieve the current user. An anonymous or expired session returns HTTP 401.
- Call `POST /api/auth/logout` with the browser's normal same-origin request behavior; include its `Origin` header. It returns HTTP 204.

Do not submit SteamID64 or role values from the browser as authentication evidence.
