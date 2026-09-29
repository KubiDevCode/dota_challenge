import { Queue, UnrecoverableError, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import { PrismaClient } from '@aegis-trials/backend/generated/client'
import { MatchProcessingService, StratzProviderError } from '@aegis-trials/backend'

export const MATCH_SYNC_QUEUE = 'match-sync'
export const PLAYER_SYNC_JOB = 'player-match-sync'
export const SCAN_JOB = 'scan-active-challenges'
export const SYNC_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'custom' as const },
  removeOnComplete: true,
  removeOnFail: true,
}

export function retryDelay(attemptsMade: number, error: Error): number {
  if (!(error instanceof StratzProviderError) || !error.retryable) return -1
  return Math.max(Math.min(60_000, 5_000 * 2 ** (attemptsMade - 1)), error.retryAfterMs ?? 0)
}

export function logJob(event: string, fields: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ event, queue: MATCH_SYNC_QUEUE, ...fields }))
}

export async function scanActiveUsers(db: PrismaClient, queue: Queue): Promise<number> {
  let cursor = '00000000-0000-0000-0000-000000000000'
  let count = 0
  while (true) {
    const rows = await db.$queryRaw<{ userId: string }[]>`
      SELECT DISTINCT "userId" FROM "UserChallenge"
      WHERE status = 'ACTIVE' AND "userId" > ${cursor}::uuid
      ORDER BY "userId" LIMIT 500`
    for (const row of rows) {
      await queue.add(PLAYER_SYNC_JOB, { userId: row.userId }, {
        ...SYNC_JOB_OPTIONS, jobId: `player-${row.userId}`,
      })
    }
    count += rows.length
    if (rows.length < 500) return count
    cursor = rows[rows.length - 1].userId
  }
}

export async function processSyncJob(
  job: Job, db: PrismaClient, pipeline: MatchProcessingService, queue: Queue, redis: IORedis,
): Promise<{ matchCount: number }> {
  if (job.name === SCAN_JOB) {
    logJob('job_started', { job: SCAN_JOB })
    const count = await scanActiveUsers(db, queue)
    logJob('job_completed', { job: SCAN_JOB, userCount: count })
    return { matchCount: 0 }
  }
  if (job.name !== PLAYER_SYNC_JOB || typeof job.data?.userId !== 'string') {
    throw new UnrecoverableError('Invalid sync job')
  }
  const userId = job.data.userId as string
  let accountId: number | undefined
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { accountId32: true } })
    if (!user) throw new UnrecoverableError('User not found')
    accountId = Number(user.accountId32)
    await job.updateData({ userId, accountId })
    logJob('job_started', { job: PLAYER_SYNC_JOB, userId, accountId, attempt: job.attemptsMade + 1 })
    const prior = await db.matchSyncState.findUnique({ where: { userId } })
    const result = await pipeline.processPlayerMatches(userId, prior?.lastMatchId ?? undefined)
    await db.matchSyncState.upsert({
      where: { userId },
      create: { userId, lastMatchId: result.lastMatchId, lastSuccessfulAt: new Date() },
      update: { lastMatchId: result.lastMatchId, lastSuccessfulAt: new Date() },
    })
    try {
      await redis.del(`aegis:match-sync:failure:${userId}`)
    } catch {
      // The durable success record is already committed in PostgreSQL.
      logJob('status_write_failed', { job: PLAYER_SYNC_JOB, userId, accountId })
    }
    logJob('job_completed', { job: PLAYER_SYNC_JOB, userId, accountId, matchCount: result.matchCount })
    return { matchCount: result.matchCount }
  } catch (error) {
    const retryable = error instanceof StratzProviderError && error.retryable
    const code = error instanceof StratzProviderError ? error.code : 'PROCESSING_ERROR'
    try {
      await redis.hset(`aegis:match-sync:failure:${userId}`, {
        failedAt: String(Date.now()), retryable: String(retryable), code,
      })
      await redis.expire(`aegis:match-sync:failure:${userId}`, 7 * 86400)
    } catch {
      logJob('status_write_failed', { job: PLAYER_SYNC_JOB, userId, accountId })
    }
    if (!retryable) throw new UnrecoverableError(code)
    throw error
  }
}

export async function closeWorkerResources(worker: Pick<Worker, 'close'>, queue: Pick<Queue, 'close'>,
  redis: Pick<IORedis, 'quit'>, db: Pick<PrismaClient, '$disconnect'>): Promise<void> {
  try {
    await worker.close()
  } finally {
    try {
      await queue.close()
    } finally {
      try {
        await redis.quit()
      } finally {
        await db.$disconnect()
      }
    }
  }
}
