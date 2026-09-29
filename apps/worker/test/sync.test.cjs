const assert = require('node:assert/strict')
const { test } = require('node:test')
const { StratzProviderError } = require('@aegis-trials/backend')
const { UnrecoverableError } = require('bullmq')
const { closeWorkerResources, processSyncJob, retryDelay, scanActiveUsers, SYNC_JOB_OPTIONS } = require('../dist/sync')

test('transient STRATZ failures retry with exponential backoff and Retry-After; permanent failures stop', () => {
  assert.equal(SYNC_JOB_OPTIONS.attempts, 4)
  assert.equal(SYNC_JOB_OPTIONS.backoff.type, 'custom')
  const timeout = new StratzProviderError('TIMEOUT', true)
  assert.equal(retryDelay(1, timeout), 5000)
  assert.equal(retryDelay(2, timeout), 10000)
  assert.equal(retryDelay(4, timeout), 40000)
  assert.equal(retryDelay(1, new StratzProviderError('RATE_LIMITED', true, 30000)), 30000)
  assert.equal(retryDelay(1, new StratzProviderError('NETWORK_ERROR', true)), 5000)
  assert.equal(retryDelay(1, new StratzProviderError('HTTP_ERROR', true, undefined, 503)), 5000)
  assert.equal(retryDelay(1, new StratzProviderError('NOT_FOUND', false)), -1)
})

function fixture(processPlayerMatches) {
  const states = []
  const db = {
    user: { findUnique: async ({ where }) => where.id === 'user-1' ? { accountId32: 123n } : null },
    matchSyncState: {
      findUnique: async () => states.at(-1) ?? null,
      upsert: async ({ create }) => { states.push(create); return create },
    },
  }
  const redis = { del: async () => {}, hset: async () => {}, expire: async () => {} }
  const queue = {}
  const job = { name: 'player-match-sync', data: { userId: 'user-1' }, attemptsMade: 0,
    updateData: async (data) => { job.data = data } }
  return { states, db, redis, queue, job, pipeline: { processPlayerMatches } }
}

test('successful sync saves cursor only after pipeline completes; duplicate execution does not duplicate reward', async () => {
  let rewards = 0
  const awarded = new Set()
  const f = fixture(async (_userId, cursor) => {
    assert.equal(cursor, awarded.size ? '99' : undefined)
    if (!awarded.has('challenge-1')) { awarded.add('challenge-1'); rewards++ }
    return { matchCount: awarded.size ? 1 : 0, lastMatchId: '99' }
  })
  await processSyncJob(f.job, f.db, f.pipeline, f.queue, f.redis)
  await processSyncJob(f.job, f.db, f.pipeline, f.queue, f.redis)
  assert.equal(rewards, 1)
  assert.equal(f.states.length, 2)
  assert.equal(f.states[1].lastMatchId, '99')
})

test('retryable failure preserves successful cursor and permanent error has no success write', async () => {
  const f = fixture(async () => { throw new StratzProviderError('TIMEOUT', true) })
  await assert.rejects(processSyncJob(f.job, f.db, f.pipeline, f.queue, f.redis), StratzProviderError)
  assert.equal(f.states.length, 0)
  f.pipeline.processPlayerMatches = async () => { throw new StratzProviderError('NOT_FOUND', false) }
  await assert.rejects(processSyncJob(f.job, f.db, f.pipeline, f.queue, f.redis), UnrecoverableError)
  assert.equal(f.states.length, 0)
})

test('one scan enqueues one bounded job ID per active user', async () => {
  const calls = []
  const db = { $queryRaw: async () => [{ userId: 'a' }, { userId: 'b' }] }
  const queue = { add: async (...args) => { calls.push(args) } }
  assert.equal(await scanActiveUsers(db, queue), 2)
  assert.deepEqual(calls.map(([, , options]) => options.jobId), ['player-a', 'player-b'])
})

test('shutdown closes worker, queue, Redis and database in order', async () => {
  const closed = []
  await closeWorkerResources(
    { close: async () => { closed.push('worker') } },
    { close: async () => { closed.push('queue') } },
    { quit: async () => { closed.push('redis') } },
    { $disconnect: async () => { closed.push('database') } },
  )
  assert.deepEqual(closed, ['worker', 'queue', 'redis', 'database'])
})

test('shutdown still disconnects Redis and database when worker close fails', async () => {
  const closed = []
  await assert.rejects(closeWorkerResources(
    { close: async () => { closed.push('worker'); throw new Error('close failed') } },
    { close: async () => { closed.push('queue') } },
    { quit: async () => { closed.push('redis') } },
    { $disconnect: async () => { closed.push('database') } },
  ), /close failed/)
  assert.deepEqual(closed, ['worker', 'queue', 'redis', 'database'])
})
