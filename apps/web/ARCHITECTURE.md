# Frontend architecture

## Before migration

| Source | Responsibility | State / data / API |
| --- | --- | --- |
| `src/main.tsx`, `src/App.tsx` | Bootstrap, BrowserRouter, routes | `/`, `/challenges`, `/leaderboard`, `/profile`; unknown URLs redirect home |
| `src/components/Layout.tsx` | Header, navigation, footer, Outlet | Local mobile menu; Steam buttons are inert prototype UI |
| `src/components/ChallengeCard.tsx` | Presentational challenge card | Props only |
| `src/pages/HomePage.tsx` | Landing, progress, instructions, season reward | Static prototype content |
| `src/pages/ChallengesPage.tsx` | Filters, grid, active slots, activation modal | Local difficulty, selected challenge, active IDs (initially `[2]`, maximum 3); resets on unmount |
| `src/pages/LeaderboardPage.tsx` | Podium and standings | Static leaders; search and region buttons are inert |
| `src/pages/ProfilePage.tsx` | Profile, rank, achievements, chart, history | Static profile and completed-challenge history; action buttons are inert |
| `src/data.ts` | Challenge types, six challenges, six leaders | Static fixtures, Lucide icons; no network calls |
| `src/index.css` | Tailwind 4 and prototype styles | Responsive styles and motion preferences |

No HTTP calls, authentication, persistence, server cache, complex forms, or frontend tests existed.

## File migration

| Original file | New location / split |
| --- | --- |
| `src/index.css` | `src/app/styles/index.css` (contents unchanged) |
| `src/components/Layout.tsx` | `src/app/routes/Layout.tsx`, `src/widgets/header/Header.tsx` |
| `src/components/ChallengeCard.tsx` | `src/entities/challenge/ChallengeCard.tsx` |
| `src/data.ts` | `src/entities/challenge/data.ts`, `src/entities/user/data.ts` |
| `src/pages/HomePage.tsx` | `src/pages/home/HomePage.tsx`, `src/widgets/profile-summary/ProgressCard.tsx` |
| `src/pages/ChallengesPage.tsx` | `src/pages/challenges/ChallengesPage.tsx`, challenge widgets and action/filter features |
| `src/pages/LeaderboardPage.tsx` | `src/pages/leaderboard/LeaderboardPage.tsx`, `src/widgets/leaderboard-table/LeaderboardTable.tsx` |
| `src/pages/ProfilePage.tsx` | `src/pages/profile/ProfilePage.tsx`, profile/history widgets and achievement/match entities |
| `src/App.tsx`, `src/main.tsx` | Retained as bootstrap files; routing and providers moved into `src/app` |

New infrastructure: `src/app/providers/{router,query-client,error-boundary}`,
`src/app/routes/AppRoutes.tsx`, `src/shared/{api,config,ui}` and `src/vite-env.d.ts`.
New route: `src/pages/admin`. Each slice has a public `index.ts`.
Tests: `src/shared/api/client.test.ts`, `src/app/providers/providers.test.tsx`,
`src/app/routes/AppRoutes.test.tsx`, `test/architecture.test.ts`.

## After migration

Imports flow `app → pages → widgets → features → entities → shared`.
Slices expose `index.ts`; cross-slice deep imports and same-layer slice imports are forbidden.
Relative imports keep the existing Vite/TypeScript setup simple.

- `app`: application Error Boundary, one stable QueryClient per app mount, router, layout, styles.
- `pages`: compose home, challenges, leaderboard, profile and admin screens.
- `widgets`: header, challenge grid, active challenges, leaderboard table, profile summary/progress and history.
- `features`: URL difficulty filter, activation dialog and cancel action.
- `entities`: challenge fixtures/model/card, user leaderboard fixtures, demo match history and achievement UI.
- `shared`: configurable HTTP client, public browser configuration, reusable loading/error UI.

No empty slices or speculative server models are introduced. The prototype CSS is moved unchanged.
`/profile` remains available; `/profile/:id` only shows the known demo profile for its demo ID.
Unknown profiles explain that profile lookup is not connected. `/admin` explains that administration is unavailable;
it neither pretends to authenticate users nor implements backend administration.

## State and integration

Difficulty lives in `?difficulty=easy|medium|hard`; missing/invalid values show all challenges.
Other search parameters are preserved. Back/forward and direct URLs work.
The mobile menu and selected dialog stay local. Demo active challenges are local to the challenges page,
including the original reset on route departure. They are not server state or persisted rewards.
No global client UI state exists, so Zustand is deliberately not installed and no store is created.
Introduce it only when genuine cross-screen client UI state appears; never store server data in it.

TanStack Query owns future server data. Put endpoint adapters and query hooks in the owning entity/feature,
call `shared/api`, forward the query signal, and use `LoadingState` / `ErrorState` at the consuming widget.
Do not add HTTP calls to pages. Static fixtures are not wrapped in fake asynchronous API calls.
The UI does not call backend endpoints until matching frontend contracts are implemented.

`VITE_API_BASE_URL` is a public base URL (default `/api`), read from the root environment by Vite.
It must never contain secrets. API paths passed to the client are relative to that base.
Requests include credentials for future sessions. JSON request bodies, cancellation, empty responses,
network failures, malformed JSON and non-2xx responses are handled centrally. Generic response types are
compile-time contracts; validate untrusted domain payloads with Zod when real contracts are available.

## Forms

React Hook Form, Zod and `@hookform/resolvers` are installed for complex forms.
Define the schema next to its feature; use `useForm` with `zodResolver(schema)` and `z.input` / `z.output`
when transformations change output types. Keep simple buttons/filters as simple controls.
No fictitious admin form or generic form abstraction is introduced.

## Verification and handoff

Run from the repository root: `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Frontend only: `npm run test -w @aegis-trials/web` (Vitest + React Testing Library).
The architecture test checks import direction, public entrypoints, same-layer isolation and page HTTP calls.

Existing XP, dates, countdowns, rankings, achievements and Steam labels are prototype content.
Authentication, match sync, rewards, leaderboard/admin APIs and action buttons that were already inert remain unimplemented.
Production hosting must fall back to `index.html` for SPA routes and proxy `/api` (or configure the public API base URL).
Google Fonts remains the existing external font dependency.
The root `docs/architecture.md` describes the earlier foundation; this file documents the completed frontend migration.
