# Aegis Trials — agent guidelines

## General

- Keep implementations simple. Do not overengineer.
- Follow existing architecture. Read relevant code and configuration before editing.
- Do not modify unrelated code or rewrite working code without a reason.
- Prefer existing dependencies. Do not introduce speculative abstractions.
- Use npm workspaces and the root lockfile; do not create per-workspace lockfiles.
- Coordinate changes to root configuration and packages/shared across agents.
- Foundation scope is infrastructure only. Do not add business modules or integrations unless the task explicitly requests them.

## Frontend

The target architecture is Feature-Sliced Design: app → pages → widgets → features → entities → shared.
The existing prototype in apps/web/src is intentionally preserved; migrate incrementally in a separate task.

- shared must not depend on upper layers.
- entities own entity models; features own user actions; widgets assemble major UI blocks.
- pages compose screens; app contains providers and bootstrap.
- Each slice exposes a public API through index.ts.
- Imports between slices on the same layer are forbidden.
- pages must not make direct HTTP requests.
- TanStack Query owns server state. URL stores filters and pagination.
- useState is for local UI state; Zustand is only for truly global client UI state.
- Do not install state libraries just to satisfy this future architecture before they are needed.
- Never expose secrets through VITE_ variables or shared browser code.

## Backend

NestJS is a modular monolith. The worker runs as a separate process.

- Controllers contain no business logic. Services implement use cases.
- Isolate database access and wrap external integrations in adapters.
- The rule engine must not depend on NestJS, Prisma or STRATZ.
- API and Worker may use packages/shared. Keep it browser-safe and framework-independent.
- Do not import app internals into another app or into packages/shared.
- Rewards must be awarded transactionally and idempotently.
- STRATZ will be hidden behind MatchProvider. OpenDota is not implemented.

## Security

- Never commit secrets. Keep actual environment files out of version control.
- Validate external input. Check authorization server-side.
- Treat authentication, payment and admin code as security-sensitive.
- Do not trust client-supplied data without verification.

## Quality

After changes, run where possible from the repository root:

```sh
npm run test
npm run typecheck
npm run lint
npm run build
```

Report actual results and unresolved issues. Keep existing UI behavior and tests intact.
