# Aegis Trials architecture

## Current foundation

The repository uses npm workspaces with one root package-lock.json.

| Workspace | Responsibility | Current implementation |
| --- | --- | --- |
| apps/web | Browser UI | React 18, TypeScript, Vite 6, Tailwind CSS 4; preserved prototype |
| apps/api | HTTP boundary and persistence adapter | NestJS 11, validated configuration, shared Prisma service, health and Swagger |
| apps/worker | Separate background process | BullMQ match synchronization worker and periodic scan |
| packages/backend | Shared server-only code | MatchProvider, STRATZ adapter, match processing pipeline, Prisma client |
| packages/shared | Framework-independent cross-app contracts | Application name, API prefix, health response type |

The browser prototype retains its existing routes, local challenge interactions, styles and mock data.
Its displayed XP, seasons, leaderboard and achievements remain prototype content; no backend behavior was added.
FSD migration is deferred. Future layers: app, pages, widgets, features, entities, shared; see ../AGENTS.md.

All apps depend on shared through its public npm package export. Shared compiles to CommonJS with declarations,
consumed by Node.js and Vite. It has no runtime dependencies or server-only imports.
Build shared first, then apps. The root scripts enforce that order; dev also watches shared.
Web remains ESM with bundler module resolution; API/Worker use Node16 resolution and CommonJS.
The base TypeScript options live in tsconfig.base.json; server options in tsconfig.node.json.

API is a modular monolith. Controllers are HTTP adapters, services implement use cases, persistence and
providers are isolated. The worker is a standalone Node.js process using the shared backend pipeline.

GET /api/health returns `{ "status": "ok", "service": "api" }`: process liveness only, not database readiness.
Swagger UI lives at /api/docs, with the schema at /api/openapi.json.
The global ValidationPipe transforms DTOs and rejects undeclared properties; future DTOs must have validation decorators.
Errors use `{ statusCode, message }`; validation may return a message array. Server error details stay in server logs.
API startup validates NODE_ENV, API_PORT, API_HOST and DATABASE_URL. The Prisma service is a singleton;
it opens a connection on the first query and disconnects during shutdown. Health remains process liveness only.
Root .env is resolved relative to app files, so compiled and development entrypoints use the same file.
Vite reads root environment configuration and proxies /api to the local API; only VITE_ variables enter client code.
No CORS configuration is needed for this same-origin development proxy.

## Target system (future; not deployed or integrated)

```text
Browser
   │
   ▼
Nginx
   ├── / → React SPA
   └── /api → NestJS API
                    │
          ┌─────────┼───────────┐
          ▼         ▼           ▼
      PostgreSQL   Redis      BullMQ
                                  │
                                  ▼
                               Worker
                                  │
                                  ▼
                               STRATZ
```

BullMQ uses Redis as its queue storage; it is not a separate database. Redis also stores sessions,
manual refresh cooldowns and short-lived failure status. Nginx will serve the SPA with route fallback
and proxy /api. There is no deployment setup here.
Reward writes must be transactional and idempotent. The rule engine must remain independent of NestJS, Prisma and providers.

STRATZ is isolated in `packages/backend/src/integrations/stratz`. The provider-neutral
`MatchProvider` contract lives in `packages/backend/src/integrations/match-provider.ts`:

```ts
interface MatchProvider {
  getPlayerMatches(
    accountId: number,
    afterMatchId?: string,
  ): Promise<ProviderMatch[]>;

  getMatch(matchId: string): Promise<ProviderMatch>;
}
```

`ProviderMatch` contains a string match ID, start time, optional duration, normalized mode
(`RANKED`, `ALL_PICK`, `UNSUPPORTED`), and normalized per-player metrics. Absent STRATZ stats remain
absent, so the rule engine can later return `PENDING`. Provider metadata and raw match payload
are available through `source` for persistence. The adapter never writes to Prisma;
the match processing service calls it through the `MatchProvider` contract.

The player history query fetches the latest 50 matches without a cursor. With `afterMatchId`,
it scans descending pages until that match ID is reached, the history ends, or ten pages have
been read. A scan that reaches the ten-page limit throws instead of returning incomplete data.
`getMatch` requests one complete match. Both calls use a token from `STRATZ_API_TOKEN` and a
configurable timeout (`STRATZ_TIMEOUT_MS`, default 10000). Missing token affects only provider
calls. Rate limit errors expose retryability and `Retry-After`; external error text is not logged.
OpenDota is not implemented.

The match processing service in `packages/backend/src/matches` is called by the worker.
`processPlayerMatches` fetches complete match details and processes
history oldest first. `processMatch` processes one specified match; callers handling historical
matches should use the history method to establish chronological order. A single-match
challenge claims the first eligible match it processes. If that evaluation is `PENDING`, later
matches cannot replace the claimed attempt. Reprocessing the same match can resolve it.

One transaction locks the user row, upserts the match and that user's nullable player stats,
evaluates each eligible active challenge, and writes the evaluation. Missing provider metrics
remain null; later imports fill them without erasing already known metrics. Eligible modes are
public Ranked and All Pick, further restricted by `Challenge.allowedMatchModes` when configured.
The match must start strictly after activation. Final evaluation records are not recalculated.
`attemptsChecked` counts final PASS/FAIL evaluations, not PENDING records. A PERSISTENT FAIL
leaves the challenge active; a SINGLE_MATCH FAIL ends it. A PASS changes status to `SUCCEEDED`.

The same transaction creates one `RewardLedger` row per completion, increments global XP, and
increments a season score when the match falls within a non-draft season. The ledger's primary
key and the user row lock protect retries and concurrent processors. A match outside a season
still awards XP and records zero season points. Level is derived from total XP and the configured
`LevelThreshold` rows rather than stored as mutable user state.

## Match synchronization

The API enqueues `player-match-sync` jobs in the `match-sync` BullMQ queue. The worker owns one
BullMQ scheduler that runs `scan-active-challenges` every two minutes. Each scan reads distinct
users with ACTIVE challenges in batches and enqueues one sync job per user. A stable job ID
(`player-<userId>`) prevents duplicate queued or running work. Completed and exhausted failed
jobs are removed so later scans can enqueue again.

`POST /api/me/matches/refresh` uses a Redis `SET NX PX` key for a 60-second cooldown.
`GET /api/me/match-sync-status` returns only the authenticated user's state and last success.
The worker persists a cursor and last successful time in `MatchSyncState` only after the pipeline
finishes. Retries replay the same range safely. Pending evaluations are revisited when STRATZ
may have filled missing statistics. Provider timeouts, rate limits and network failures retry
up to four attempts with exponential backoff; permanent errors stop immediately. The worker
closes BullMQ, Redis and Prisma on shutdown.

## Scope boundary

Deferred: OpenDota, achievements and production deployment.

Infrastructure follows the official NestJS documentation for
[configuration](https://docs.nestjs.com/techniques/configuration),
[validation](https://docs.nestjs.com/techniques/validation), and
[OpenAPI](https://docs.nestjs.com/openapi/introduction).
