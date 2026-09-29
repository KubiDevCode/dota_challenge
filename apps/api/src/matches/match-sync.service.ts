import { Injectable, OnModuleDestroy, OnModuleInit, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { PrismaService } from '../database/prisma.service'

export const MATCH_SYNC_QUEUE = 'match-sync'
export const PLAYER_SYNC_JOB = 'player-match-sync'
export const SYNC_JOB_OPTIONS = {
  attempts: 4,
  backoff: { type: 'custom' as const },
  removeOnComplete: true,
  removeOnFail: true,
}

@Injectable()
export class MatchSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: IORedis
  private readonly queue: Queue
  private readonly testMode: boolean

  constructor(config: ConfigService, private readonly db: PrismaService) {
    this.testMode = config.get<string>('NODE_ENV') === 'test'
    this.redis = new IORedis(config.getOrThrow<string>('REDIS_URL'), {
      maxRetriesPerRequest: 1, lazyConnect: this.testMode,
    })
    this.queue = new Queue(MATCH_SYNC_QUEUE, { connection: this.redis })
  }

  async onModuleInit(): Promise<void> { if (!this.testMode) await this.redis.ping() }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close()
    if (this.redis.status !== 'end') await this.redis.quit()
  }

  async refresh(userId: string) {
    const key = `aegis:match-sync:cooldown:${userId}`
    const token = `${Date.now()}-${Math.random()}`
    const claimed = await this.redis.set(key, token, 'PX', 60_000, 'NX')
    if (claimed !== 'OK') {
      const waitMs = Math.max(0, await this.redis.pttl(key))
      throw new HttpException({ statusCode: 429, message: 'Match refresh cooldown', retryAfterSeconds: Math.ceil(waitMs / 1000) }, HttpStatus.TOO_MANY_REQUESTS)
    }
    try {
      const job = await this.queue.add(PLAYER_SYNC_JOB, { userId }, {
        ...SYNC_JOB_OPTIONS, jobId: `player-${userId}`,
      })
      return { status: 'queued', jobId: job.id }
    } catch (error) {
      await this.redis.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0', 1, key, token)
      throw error
    }
  }

  async status(userId: string) {
    const [job, state, failure] = await Promise.all([
      this.queue.getJob(`player-${userId}`),
      this.db.matchSyncState.findUnique({ where: { userId } }),
      this.redis.hgetall(`aegis:match-sync:failure:${userId}`),
    ])
    const jobState = job ? await job.getState() : null
    const status = jobState === 'active' ? 'processing'
      : jobState === 'delayed' ? 'failed'
      : jobState && ['waiting', 'paused', 'prioritized', 'waiting-children'].includes(jobState) ? 'queued'
      : failure.failedAt && (!state?.lastSuccessfulAt || Number(failure.failedAt) > state.lastSuccessfulAt.getTime()) ? 'failed'
      : 'idle'
    return {
      status,
      retryable: jobState === 'delayed' || (status === 'failed' && failure.retryable === 'true'),
      lastSuccessfulSync: state?.lastSuccessfulAt ?? null,
    }
  }
}
