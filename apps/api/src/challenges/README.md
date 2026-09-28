# Challenge lifecycle

`GET /api/challenges` lists only `PUBLISHED` challenges whose `availableFrom` is absent or in the past. The schema currently has no Challenge–Season relation, so there is no season condition to apply. Both `PERSISTENT` and `SINGLE_MATCH` are represented by the `mode` field; match evaluation is outside this module.

`POST /api/challenges/:id/activate` requires the project's `AuthGuard`. It creates one `ACTIVE` UserChallenge with a server timestamp. The existing `(userId, challengeId)` unique key makes activation a once-per-challenge operation, including after cancellation or completion. The service returns a conflict for a second activation.

The active limit is enforced inside a Prisma interactive transaction. Before checking the existing enrollment, counting `ACTIVE` records, and creating one, the transaction locks the user's PostgreSQL row with `SELECT ... FOR UPDATE`. Concurrent activations for the same user therefore run their count and insert in sequence across API processes. Any future path that creates `ACTIVE` records for a user must take the same lock. The database unique key remains the final duplicate safeguard.

Cancellation is an atomic conditional `ACTIVE → CANCELLED` update scoped by both enrollment ID and authenticated user ID. `CANCELLED`, `SUCCEEDED`, and `FAILED` are terminal for this API; no reward is issued here. Match processing must consider only `ACTIVE` records, require `Match.startedAt > activatedAt`, distinguish the two modes, and condition its own terminal status update on `ACTIVE` so cancellation cannot be overwritten. Rewards and attempts belong to that later pipeline.
