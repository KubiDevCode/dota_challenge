const assert = require('node:assert/strict')
const { test } = require('node:test')
const { RankingsService } = require('../dist/rankings/rankings.service')
const { MatchHistoryService } = require('../dist/matches/match-history.service')
const { levelForXp } = require('../dist/matches/level')

const season = { id: 'season-1', name: 'First', startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01') }
const thresholds = [
  { level: 1, requiredTotalXp: 0, rankName: 'Initiate' },
  { level: 2, requiredTotalXp: 100, rankName: 'Veteran' },
  { level: 3, requiredTotalXp: 200, rankName: 'Legend' },
]
const users = [
  { id: 'a', displayName: 'A', avatarUrl: null, totalXp: 99 },
  { id: 'b', displayName: 'B', avatarUrl: null, totalXp: 100 },
  { id: 'c', displayName: 'C', avatarUrl: null, totalXp: 200 },
]
const scores = [
  { userId: 'c', points: 20, createdAt: new Date('2026-01-02'), user: users[2] },
  { userId: 'a', points: 10, createdAt: new Date('2026-01-03'), user: users[0] },
  { userId: 'b', points: 10, createdAt: new Date('2026-01-03'), user: users[1] },
]

function rankingFixture(active = [season]) {
  const calls = []
  const db = {
    season: { findMany: async (args) => { calls.push(['season', args]); return active.slice(0, args.take) } },
    levelThreshold: { findMany: async () => thresholds },
    seasonScore: {
      findMany: async (args) => {
        calls.push(['scores', args])
        return scores.slice(args.skip, args.skip + args.take)
      },
      findUnique: async (args) => { calls.push(['score', args]); return { points: 10 } },
    },
    user: { findUnique: async (args) => {
      calls.push(['user', args])
      return args.where.id === 'a' ? { ...users[0], _count: { challenges: 2 } } : null
    } },
  }
  return { service: new RankingsService(db), calls }
}

test('current season requires exactly one ACTIVE row', async () => {
  assert.deepEqual(await rankingFixture().service.currentSeason(), season)
  await assert.rejects(rankingFixture([]).service.currentSeason(), error => error.getStatus?.() === 404)
  await assert.rejects(rankingFixture([season, { ...season, id: 'season-2' }]).service.currentSeason(),
    error => error.getStatus?.() === 500)
})

test('level reaches the new rank at the exact XP threshold', () => {
  assert.equal(levelForXp(99, thresholds).level, 1)
  assert.equal(levelForXp(100, thresholds).level, 2)
  assert.equal(levelForXp(200, thresholds).level, 3)
  assert.equal(levelForXp(0, [{ level: 1, requiredTotalXp: 10, rankName: 'Later' }]), null)
})

test('leaderboard uses indexed deterministic ordering and bounded database pagination', async () => {
  const { service, calls } = rankingFixture()
  const first = await service.leaderboard({ page: 1, limit: 2 })
  assert.deepEqual(first.items.map(row => [row.userId, row.position, row.seasonalScore]),
    [['c', 1, 20], ['a', 2, 10]])
  assert.equal(first.hasMore, true)
  assert.equal(first.items[1].level.level, 1)
  const second = await service.leaderboard({ page: 2, limit: 2 })
  assert.deepEqual(second.items.map(row => [row.userId, row.position]), [['b', 3]])
  assert.equal(second.items[0].level.level, 2)
  assert.equal(second.hasMore, false)
  const requests = calls.filter(([name]) => name === 'scores').map(([, args]) => args)
  assert.deepEqual(requests[0].orderBy, [{ points: 'desc' }, { createdAt: 'asc' }, { userId: 'asc' }])
  assert.deepEqual(requests.map(args => [args.skip, args.take]), [[0, 3], [2, 3]])
  assert.equal(requests[0].select.user.select.steamId64, undefined)
})

test('public profile exposes a whitelist and counts completed challenges', async () => {
  const { service, calls } = rankingFixture()
  assert.deepEqual(await service.publicProfile('a'), {
    id: 'a', displayName: 'A', avatarUrl: null, totalXp: 99,
    level: thresholds[0], seasonalScore: 10, seasonId: season.id, completedChallenges: 2,
  })
  const selection = calls.find(([name]) => name === 'user')[1].select
  assert.equal(selection.steamId64, undefined)
  assert.equal(selection.role, undefined)
  assert.deepEqual(selection._count.select.challenges.where, { status: 'SUCCEEDED' })
  assert.equal((await rankingFixture([]).service.publicProfile('a')).seasonalScore, 0)
  await assert.rejects(rankingFixture().service.publicProfile('unknown'), error => error.getStatus?.() === 404)
})

test('private history scopes the query to its principal and handles empty pages', async () => {
  const calls = []
  const match = { startedAt: new Date('2026-05-01'), duration: 1200, matchMode: 2 }
  const db = { playerMatchStats: { findMany: async (args) => {
    calls.push(args)
    return args.where.userId === 'owner' ? [
      { matchId: '123', win: true, kills: 3, deaths: 1, assists: 5,
        killParticipation: .5, lastHits: 20, heroDamage: 100, towerDamage: 10,
        wardsPlaced: 1, heroId: 1, match },
    ] : []
  } } }
  const service = new MatchHistoryService(db)
  const result = await service.listMine('owner', { page: 1, limit: 1 })
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].startedAt, match.startedAt)
  assert.equal(result.items[0].rawPayload, undefined)
  assert.deepEqual(calls[0].orderBy, [{ match: { startedAt: 'desc' } }, { matchId: 'desc' }])
  assert.deepEqual([calls[0].skip, calls[0].take], [0, 2])
  assert.deepEqual(await service.listMine('other', { page: 1, limit: 20 }),
    { items: [], page: 1, limit: 20, hasMore: false })
  assert.equal(calls[1].where.userId, 'other')
})
