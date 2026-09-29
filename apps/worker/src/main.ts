import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@aegis-trials/backend/generated/client'
import { MatchProcessingService, StratzMatchProvider, StratzProviderError } from '@aegis-trials/backend'
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { closeWorkerResources, logJob, MATCH_SYNC_QUEUE, processSyncJob, retryDelay, SCAN_JOB } from './sync'

const envPath = resolve(__dirname, '../../../.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.REDIS_URL) throw new Error('DATABASE_URL and REDIS_URL are required')
  const timeoutMs = process.env.STRATZ_TIMEOUT_MS ? Number(process.env.STRATZ_TIMEOUT_MS) : 10000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
    throw new Error('STRATZ_TIMEOUT_MS must be between 100 and 60000')
  }
  const redis = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
  const queue = new Queue(MATCH_SYNC_QUEUE, { connection: redis })
  const provider = new StratzMatchProvider({ token: process.env.STRATZ_API_TOKEN, timeoutMs })
  const pipeline = new MatchProcessingService(db, provider)
  const worker = new Worker(MATCH_SYNC_QUEUE,
    (job) => processSyncJob(job, db, pipeline, queue, redis),
    { connection: redis, concurrency: 4, settings: { backoffStrategy: (attempts, _type, error) => retryDelay(attempts, error ?? new Error('Unknown')) } })
  worker.on('failed', (job, error) => {
    if (!job) return
    const retrying = job.attemptsMade < (job.opts.attempts ?? 1) && !(error.name === 'UnrecoverableError')
    logJob(retrying ? 'job_retry' : 'job_failed', {
      job: job.name, userId: job.data?.userId, accountId: job.data?.accountId, attempt: job.attemptsMade,
      code: error instanceof StratzProviderError ? error.code : error.name,
      ...(retrying && { delayMs: retryDelay(job.attemptsMade, error) }),
    })
  })
  worker.on('error', (error) => logJob('worker_error', { code: error.name }))
  let stopping = false
  const shutdown = async () => {
    if (stopping) return
    stopping = true
    await closeWorkerResources(worker, queue, redis, db)
    logJob('worker_stopped')
  }
  process.once('SIGINT', () => { void shutdown().catch(() => { process.exitCode = 1 }) })
  process.once('SIGTERM', () => { void shutdown().catch(() => { process.exitCode = 1 }) })
  try {
    await redis.ping()
    await db.$connect()
    await queue.upsertJobScheduler('active-challenge-scan', { every: 120_000 }, {
      name: SCAN_JOB, data: {}, opts: { removeOnComplete: true, removeOnFail: true },
    })
    logJob('worker_started')
  } catch (error) {
    await shutdown()
    throw error
  }
}

void main().catch((error: unknown) => {
  logJob('worker_start_failed', { code: error instanceof Error ? error.name : 'UNKNOWN' })
  process.exitCode = 1
})
