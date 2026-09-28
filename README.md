# Aegis Trials

MVP monorepo foundation. The existing Dota 2 frontend prototype is preserved in apps/web;
API and worker currently provide infrastructure only.

## Requirements and local setup

- Node.js 22.19+ and npm 10+ (validated with Node 22.19.0 / npm 11.6.3).
- Run commands from the repository root.
- PostgreSQL 16 is required for the API and migrations. Redis, Steam and STRATZ remain deferred.

```sh
npm ci
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell,
`cp .env.example .env` in a POSIX shell), then set `DATABASE_URL` to your PostgreSQL 16 database.
The API validates the URL at startup. Leave integration credentials empty until those integrations are implemented.
Do not commit real secrets.

Generate the Prisma Client and apply committed migrations with:

```sh
npm run db:generate
npm run db:migrate
```

`npm run db:migrate` runs `prisma migrate deploy`; it does not reset or drop existing data.
The schema and initial migration are in `prisma/`. Generated Prisma Client code is server-only and ignored by Git.
PostgreSQL integration tests run when `TEST_DATABASE_URL` points to a disposable migrated database;
otherwise those tests are skipped.

```sh
npm run dev
```

This builds shared and starts its compiler watcher plus web, API and worker. Ctrl+C stops the group.
The API and worker use Node's watch mode with ts-node; no Nest CLI installation is needed.
The worker logs startup and stays idle using a keep-alive timer until stopped; it does not process jobs.

| Service | Address |
| --- | --- |
| Web | http://localhost:5173 |
| API health | http://127.0.0.1:3000/api/health |
| Swagger UI | http://127.0.0.1:3000/api/docs |
| OpenAPI JSON | http://127.0.0.1:3000/api/openapi.json |

The web dev server proxies /api (including Swagger) to the API. API_PORT in the root .env changes its target;
restart Vite after editing environment files. API_HOST defaults to 127.0.0.1. Keep the API reachable on loopback for this proxy.
Vite binds to 127.0.0.1 on port 5173 to avoid IPv4/IPv6 localhost mismatches on Windows,
and fails visibly if the port is occupied. http://127.0.0.1:5173 is also a valid web URL.

Independent processes, each in its own terminal:

```sh
npm run dev:web
npm run dev:api
npm run dev:worker
```

These commands build shared before starting. When editing shared while running apps independently,
also run `npm run dev -w @aegis-trials/shared` in another terminal (or restart the root command).
App source changes restart API/worker automatically or update Vite through HMR.

## Commands and checks

```sh
npm run test
npm run typecheck
npm run lint
npm run build
```

Build output lives in each workspace's dist directory. Shared builds before consumers; no path aliases to source are needed.
Tests build their required server code, then use Node's built-in test runner. API tests cover HTTP health,
Swagger/OpenAPI, environment validation, DTO validation, error redaction and persistence constraints.
Set `TEST_DATABASE_URL` to run the PostgreSQL integration test; otherwise it is skipped.
The worker smoke test checks startup and continued liveness without external services.
Web tests cover the existing prototype interactions. Business services remain unimplemented.

After building, preview web with `npm run preview` (port 4173), start API with
`npm run start -w @aegis-trials/api`, or worker with `npm run start -w @aegis-trials/worker`.
Vite preview is a local preview of compiled UI; deployment and production routing are deferred.

## Repository layout

```text
apps/web          Preserved React 18 / Vite / Tailwind CSS 4 frontend
apps/api          NestJS API and singleton Prisma database module
apps/worker       Separate idle Node.js worker
packages/shared   Browser-safe contracts and challenge rule types
prisma            PostgreSQL schema and versioned migrations
docs              Architecture and foundation verification notes
```

Root .env is used by all apps, with process environment taking priority. Only variables prefixed with
VITE_ are exposed to browser code; never use that prefix for database URLs, API keys or session secrets.
APP_URL, REDIS_URL, STEAM_*, STRATZ_API_TOKEN and SESSION_SECRET are reserved for later work.

See [AGENTS.md](AGENTS.md) for agent rules and [docs/architecture.md](docs/architecture.md) for current and target architecture.
See [docs/foundation-report.md](docs/foundation-report.md) for the migration file list and verification results.
Frontend FSD migration and all business modules are separate tasks.
