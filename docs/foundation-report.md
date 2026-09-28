# Foundation / monorepo migration report

Verified on 2026-09-28 on Windows, Node.js 22.19.0, npm 11.6.3.

## Repository inspection and migration

The original project was a standalone React 18 / TypeScript 5.7 / Vite 6 / Tailwind CSS 4 prototype.
It used React Router and lucide-react. All source files and existing configuration were inspected before editing.
The initial `npm run build` passed. There were no tests, backend, worker, agent instructions or Git metadata.

The migration moved frontend files to apps/web, added API/worker/shared workspaces, configured shared tooling,
documented boundaries and verified the result. No business logic or external integrations were added.
All 10 existing frontend source files, including CSS, were compared using SHA-256 and remained byte-identical.
index.html was moved unchanged. Existing root dist and tsbuildinfo artifacts were retained and ignored;
new builds emit into workspace dist directories.

## Complete source/configuration file list

Paths below are relative to the repository root. Generated dist/node_modules files are not source changes.

Updated root files:

- package.json — workspace orchestration and common tooling.
- package-lock.json — one lockfile for all workspaces.
- tsconfig.node.json — original frontend configuration moved to apps/web; root path now holds common server settings.

Created root/documentation files:

- .gitignore
- .env.example
- AGENTS.md
- README.md
- eslint.config.js
- tsconfig.base.json
- docs/architecture.md
- docs/foundation-report.md

Frontend files moved without source edits:

- index.html → apps/web/index.html
- src/App.tsx → apps/web/src/App.tsx
- src/main.tsx → apps/web/src/main.tsx
- src/index.css → apps/web/src/index.css
- src/data.ts → apps/web/src/data.ts
- src/components/Layout.tsx → apps/web/src/components/Layout.tsx
- src/components/ChallengeCard.tsx → apps/web/src/components/ChallengeCard.tsx
- src/pages/HomePage.tsx → apps/web/src/pages/HomePage.tsx
- src/pages/ChallengesPage.tsx → apps/web/src/pages/ChallengesPage.tsx
- src/pages/LeaderboardPage.tsx → apps/web/src/pages/LeaderboardPage.tsx
- src/pages/ProfilePage.tsx → apps/web/src/pages/ProfilePage.tsx
- tsconfig.json → apps/web/tsconfig.json

Frontend configuration moved/updated or created:

- apps/web/package.json — derived from the original root frontend manifest.
- tsconfig.app.json → apps/web/tsconfig.app.json — extends shared base.
- tsconfig.node.json → apps/web/tsconfig.node.json — extends shared base.
- vite.config.ts → apps/web/vite.config.ts — root environment directory, shared API prefix, development proxy, explicit IPv4 loopback.

Created API files:

- apps/api/package.json
- apps/api/tsconfig.json
- apps/api/src/main.ts
- apps/api/src/bootstrap.ts
- apps/api/src/app.module.ts
- apps/api/src/config/environment.ts
- apps/api/src/health.controller.ts
- apps/api/src/http-exception.filter.ts
- apps/api/test/infrastructure.test.cjs

Created worker files:

- apps/worker/package.json
- apps/worker/tsconfig.json
- apps/worker/src/main.ts
- apps/worker/test/startup.test.cjs

Created shared files:

- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/src/index.ts

## Commands and results

| Check | Result |
| --- | --- |
| `npm run build` before migration | Passed, established frontend baseline |
| `npm install` | Passed; root lockfile updated |
| `npm ci` after final dependency selection | Passed; 0 audit vulnerabilities |
| `npm ls --workspaces --depth=0` | Four workspaces linked; each app resolves shared |
| `npm run test` | Passed: 6 API tests + 1 worker smoke test, 0 failures |
| `npm run typecheck` | Passed for all four workspaces |
| `npm run lint` | Passed without warnings, including after ESLint 10 update |
| `npm run build` | Passed: shared, web, API, worker |
| `npm run build -w @aegis-trials/web` after loopback adjustment | Passed, including both frontend typechecks |
| `npm run dev` | Shared watcher, web, API and worker started together; Ctrl+C stopped them |
| `npm run dev:web` | Started independently; web returned HTTP 200 |
| `npm run dev:api` | Started independently; health returned HTTP 200 and expected JSON |
| `npm run dev:worker` | Started independently; idle process stayed alive and logged shutdown on Ctrl+C |

HTTP checks via PowerShell Invoke-WebRequest / Invoke-RestMethod returned 200 for:

- http://localhost:5173/
- http://127.0.0.1:5173/challenges
- http://127.0.0.1:5173/leaderboard
- http://127.0.0.1:5173/profile
- http://127.0.0.1:3000/api/health
- http://127.0.0.1:3000/api/docs
- http://127.0.0.1:5173/api/health
- http://127.0.0.1:5173/api/docs
- http://127.0.0.1:5173/api/openapi.json

The browser check covered home, challenges, leaderboard and profile; filtering to easy challenges;
opening a challenge modal; activation (1/3 → 2/3) and cancellation (2/3 → 1/3).
The homepage was visually inspected with a screenshot. No frontend source edits were necessary.

Initial Vite binding to ::1 caused an IPv4 connection failure on Windows. Explicit 127.0.0.1 binding fixed it;
both localhost and 127.0.0.1 then passed HTTP checks. This is resolved.
The initial ESLint 9 dependency was reported deprecated during install and was replaced with compatible ESLint 10.

## Remaining issues and scope limits

- No unresolved foundation blockers were found.
- Git was not initialized in the supplied directory. No commit or Git diff was created.
- No pre-existing automated tests existed to preserve. Browser checks are smoke checks, not a full UI regression suite.
- The UI retains its existing prototype data and local-only behavior. Health is process liveness only.
- Database, authentication, queue, provider integrations, business modules and deployment remain deliberately unimplemented.
