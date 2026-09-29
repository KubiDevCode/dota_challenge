const assert = require('node:assert/strict')
const { test } = require('node:test')
require('reflect-metadata')
const { AuthGuard } = require('../dist/auth/auth.guards')
const { MatchSyncController } = require('../dist/matches/match-sync.controller')
const { MatchSyncService, SYNC_JOB_OPTIONS } = require('../dist/matches/match-sync.service')

function fixture() {
  const calls = []
  const cooldown = new Map()
  const service = Object.create(MatchSyncService.prototype)
  service.redis = {
    set: async (key, token, unit, duration, condition) => {
      calls.push(['set', key, unit, duration, condition])
      if (cooldown.has(key)) return null
      cooldown.set(key, token)
      return 'OK'
    },
    pttl: async () => 59000,
    hgetall: async () => ({}),
  }
  service.queue = {
    add: async (name, data, options) => { calls.push(['add', name, data, options]); return { id: options.jobId } },
    getJob: async () => null,
  }
  service.db = { matchSyncState: { findUnique: async ({ where }) => { calls.push(['state', where]); return null } } }
  return { service, calls }
}

test('manual refresh enqueues one user job and enforces a 60-second server-side cooldown', async () => {
  const { service, calls } = fixture()
  assert.equal(SYNC_JOB_OPTIONS.attempts, 4)
  assert.equal((await service.refresh('user-1')).jobId, 'player-user-1')
  assert.deepEqual(calls[0].slice(2), ['PX', 60000, 'NX'])
  assert.deepEqual(calls[1].slice(1, 3), ['player-match-sync', { userId: 'user-1' }])
  assert.equal(calls[1][3].jobId, 'player-user-1')
  await assert.rejects(service.refresh('user-1'), { status: 429 })
  assert.equal(calls.filter(([name]) => name === 'add').length, 1)
})

test('status and routes use only the authenticated user identity', async () => {
  const { service, calls } = fixture()
  const controller = new MatchSyncController(service)
  await controller.status({ id: 'user-1' })
  assert.deepEqual(calls.find(([name]) => name === 'state')[1], { userId: 'user-1' })
  assert.ok(Reflect.getMetadata('__guards__', MatchSyncController).includes(AuthGuard))
  await controller.refresh({ id: 'user-1' })
  assert.equal(calls.find(([name]) => name === 'add')[2].userId, 'user-1')
})

test('status reports queued, processing, retryable failure, and last successful sync', async () => {
  const { service } = fixture()
  const lastSuccessfulAt = new Date('2026-09-29T10:00:00.000Z')
  service.db.matchSyncState.findUnique = async () => ({ lastSuccessfulAt })
  service.queue.getJob = async () => ({ getState: async () => 'waiting' })
  assert.deepEqual(await service.status('user-1'), {
    status: 'queued', retryable: false, lastSuccessfulSync: lastSuccessfulAt,
  })
  service.queue.getJob = async () => ({ getState: async () => 'active' })
  assert.equal((await service.status('user-1')).status, 'processing')
  service.queue.getJob = async () => ({ getState: async () => 'delayed' })
  assert.deepEqual((await service.status('user-1')).status, 'failed')
  assert.equal((await service.status('user-1')).retryable, true)
  service.queue.getJob = async () => null
  service.redis.hgetall = async () => ({ failedAt: String(Date.now()), retryable: 'false' })
  assert.deepEqual(await service.status('user-1'), {
    status: 'failed', retryable: false, lastSuccessfulSync: lastSuccessfulAt,
  })
})
