# Aegis Trials architecture

## Current foundation

The repository uses npm workspaces with one root package-lock.json.

| Workspace | Responsibility | Current implementation |
| --- | --- | --- |
| apps/web | Browser UI | React 18, TypeScript, Vite 6, Tailwind CSS 4; preserved prototype |
| apps/api | HTTP boundary and persistence adapter | NestJS 11, validated configuration, shared Prisma service, health and Swagger |
| apps/worker | Separate background process | Node.js / TypeScript entrypoint, environment loading, shutdown handlers; idle |
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
providers are isolated. No business modules exist yet. The worker is permitted to become a standalone
NestJS application when background modules are introduced; it currently needs no DI container.

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

BullMQ will use Redis as its queue storage; it is not a separate database. Redis sessions and queued jobs
are future concerns. Nginx will serve the SPA with route fallback and proxy /api. There is no deployment setup here.
Reward writes must be transactional and idempotent. The rule engine must remain independent of NestJS, Prisma and providers.

STRATZ must be hidden behind MatchProvider. The following is a future contract sketch, not a shared implementation:

```ts
interface MatchProvider {
  getPlayerMatches(
    accountId: number,
    afterMatchId?: string,
  ): Promise<ProviderMatch[]>;

  getMatch(matchId: string): Promise<ProviderMatch>;
}
```

ProviderMatch will be defined when actual provider requirements are known. Match IDs remain strings.
OpenDota is not implemented. No fallback adapter is introduced at this stage.

## Scope boundary

Deferred: Steam OpenID, Redis sessions, STRATZ, OpenDota,
BullMQ, Challenge Rule Engine/API, XP, seasons, leaderboard, achievements, admin and production deployment.
No external service is required to run this foundation.

Infrastructure follows the official NestJS documentation for
[configuration](https://docs.nestjs.com/techniques/configuration),
[validation](https://docs.nestjs.com/techniques/validation), and
[OpenAPI](https://docs.nestjs.com/openapi/introduction).
