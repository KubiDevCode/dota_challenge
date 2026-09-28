const assert = require('node:assert/strict')
const { test } = require('node:test')
const { ChallengesService } = require('../dist/challenges/challenges.service')

const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

function fixture() {
  const challenges = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    title: `Challenge ${index}`, description: 'Test', category: 'test', difficulty: 'EASY',
    mode: index % 2 ? 'PERSISTENT' : 'SINGLE_MATCH', xpReward: 10,
    seasonPointsReward: 0, allowedMatchModes: [], publicationStatus: 'PUBLISHED',
    availableFrom: null, rules: [{ metric: 'kills', operator: 'GTE', numberValue: 2 }],
  }))
  challenges[4].publicationStatus = 'DRAFT'
  challenges[5].availableFrom = new Date(Date.now() + 86400000)
  const enrollments = []
  let nextId = 0
  let tail = Promise.resolve()
  const tx = {
    $queryRaw: async () => [{ id: owner }],
    challenge: { findUnique: async ({ where }) => challenges.find(c => c.id === where.id) ?? null },
    userChallenge: {
      findUnique: async ({ where }) => enrollments.find(e => e.userId === where.userId_challengeId.userId && e.challengeId === where.userId_challengeId.challengeId) ?? null,
      count: async ({ where }) => enrollments.filter(e => e.userId === where.userId && e.status === where.status).length,
      create: async ({ data }) => {
        const row = { id: String(++nextId), ...data, attemptsChecked: 0, completedAt: null, completedByMatchId: null }
        enrollments.push(row)
        return row
      },
      findFirst: async ({ where }) => {
        const row = enrollments.find(e => e.id === where.id && e.userId === where.userId)
        return row ? { ...row, challenge: challenges.find(c => c.id === row.challengeId) } : null
      },
      updateMany: async ({ where, data }) => {
        const row = enrollments.find(e => e.id === where.id && e.userId === where.userId && e.status === where.status)
        if (!row) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
    },
  }
  const repository = {
    db: { $transaction: async (callback) => {
      const previous = tail
      let release
      tail = new Promise(resolve => { release = resolve })
      await previous
      try { return await callback(tx) } finally { release() }
    } },
    listAvailable: async (query, now) => challenges.filter(c => c.publicationStatus === 'PUBLISHED'
      && (!c.availableFrom || c.availableFrom <= now)
      && (!query.mode || c.mode === query.mode)
      && (!query.difficulty || c.difficulty === query.difficulty)
      && (!query.category || c.category === query.category))
      .slice((query.page - 1) * query.limit, query.page * query.limit),
    findUserChallenges: async (userId) => enrollments.filter(e => e.userId === userId)
      .map(e => ({ ...e, challenge: challenges.find(c => c.id === e.challengeId) })),
  }
  return { challenges, enrollments, service: new ChallengesService(repository) }
}

function status(error, expected) { return error.getStatus?.() === expected }

test('listing exposes only published available public DTOs with pagination and mode', async () => {
  const { service } = fixture()
  const result = await service.list({ page: 1, limit: 20 })
  assert.equal(result.items.length, 4)
  assert.equal(result.items[0].publicationStatus, undefined)
  assert.equal(result.items[0].createdAt, undefined)
  assert.deepEqual(result.items[0].rules[0], { metric: 'kills', operator: 'GTE', value: 2 })
  assert.equal((await service.list({ page: 1, limit: 1, mode: 'PERSISTENT' })).items.length, 1)
})

test('activation validates availability and duplicate, stamps server time, and enforces three slots', async () => {
  const { service, challenges, enrollments } = fixture()
  await assert.rejects(service.activate(owner, 'missing'), e => status(e, 404))
  await assert.rejects(service.activate(owner, challenges[4].id), e => status(e, 409))
  await assert.rejects(service.activate(owner, challenges[5].id), e => status(e, 409))
  for (let index = 0; index < 3; index++) {
    const before = Date.now()
    const active = await service.activate(owner, challenges[index].id)
    assert.equal(active.status, 'ACTIVE')
    assert.ok(active.activatedAt.getTime() >= before)
  }
  assert.equal(enrollments.length, 3)
  await assert.rejects(service.activate(owner, challenges[0].id), e => status(e, 409))
  await assert.rejects(service.activate(owner, challenges[3].id), e => status(e, 409))
})

test('serialized concurrent activations at two active records leave at most three', async () => {
  const { service, challenges, enrollments } = fixture()
  await service.activate(owner, challenges[0].id)
  await service.activate(owner, challenges[1].id)
  const results = await Promise.allSettled([2, 3].map(i => service.activate(owner, challenges[i].id)))
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected' && status(r.reason, 409)).length, 1)
  assert.equal(enrollments.filter(e => e.status === 'ACTIVE').length, 3)
})

test('listing and cancellation are scoped to owner and active state', async () => {
  const { service, challenges, enrollments } = fixture()
  const mine = await service.activate(owner, challenges[0].id)
  const completion = { id: '123', startedAt: new Date(), duration: 1500, matchMode: 2 }
  enrollments[0].completedByMatch = completion
  enrollments.push({ id: 'other', userId: other, challengeId: challenges[1].id, status: 'SUCCEEDED',
    activatedAt: new Date(), attemptsChecked: 1, completedAt: new Date(), completedByMatchId: '123' })
  const ownRows = await service.listMine(owner)
  assert.deepEqual(ownRows.map(e => e.id), [mine.id])
  assert.deepEqual(ownRows[0].completedByMatch, completion)
  await assert.rejects(service.cancel(other, mine.id), e => status(e, 404))
  await assert.rejects(service.cancel(other, 'other'), e => status(e, 409))
  assert.equal((await service.cancel(owner, mine.id)).status, 'CANCELLED')
  await assert.rejects(service.cancel(owner, mine.id), e => status(e, 409))
})
