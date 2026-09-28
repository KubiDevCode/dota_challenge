const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('../dist/database/generated/client')

const url = process.env.TEST_DATABASE_URL
const options = url ? {} : { skip: 'Set TEST_DATABASE_URL to a disposable PostgreSQL 16 database' }
let db

before(async () => {
  if (!url) return
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  await db.$connect()
})
after(async () => { await db?.$disconnect() })

test('database uniqueness protects identity, evaluation, season score and reward grants', options, async () => {
  const suffix = `${Date.now()}-${Math.random()}`
  const user = await db.user.create({ data: {
    steamId64: `765${suffix.replace(/\D/g, '').slice(0, 14)}`.slice(0, 20),
    accountId32: BigInt(Math.floor(Math.random() * 2_000_000_000)),
    displayName: 'Persistence test',
  } })
  const season = await db.season.create({ data: {
    name: `Persistence ${suffix}`,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-12-31T00:00:00Z'),
    status: 'DRAFT',
  } })
  const activeSeason = await db.season.create({ data: {
    name: `Active ${suffix}`,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: new Date('2026-12-31T00:00:00Z'),
    status: 'ACTIVE',
  } })
  const challenge = await db.challenge.create({ data: {
    title: 'Persistence test', description: 'test', category: 'test', difficulty: 'EASY', mode: 'SINGLE_MATCH',
    xpReward: 100, seasonPointsReward: 10, publicationStatus: 'PUBLISHED',
    rules: { create: { metric: 'kills', operator: 'GTE', numberValue: 1 } },
  } })
  const match = await db.match.create({ data: {
    id: `${Date.now()}`, startedAt: new Date(), duration: 1200, matchMode: 2,
    players: { create: { userId: user.id, win: true, kills: 3, deaths: 1, assists: 4,
      lastHits: 100, heroDamage: 10000, towerDamage: 1000, wardsPlaced: 2, heroId: 1 } },
  } })
  const enrollment = await db.userChallenge.create({ data: {
    userId: user.id, challengeId: challenge.id, status: 'SUCCEEDED', completedAt: new Date(), completedByMatchId: match.id,
  } })

  try {
    await assert.rejects(db.user.create({ data: {
      steamId64: user.steamId64, accountId32: user.accountId32 + 1n, displayName: 'Duplicate Steam',
    } }), { code: 'P2002' })
    await assert.rejects(db.seasonScore.createMany({ data: [
      { userId: user.id, seasonId: season.id, points: 0 },
      { userId: user.id, seasonId: season.id, points: 0 },
    ] }), { code: 'P2002' })
    await assert.rejects(db.season.create({ data: {
      name: `Second active ${suffix}`,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      endsAt: new Date('2026-12-31T00:00:00Z'),
      status: 'ACTIVE',
    } }), { code: 'P2002' })
    await db.seasonScore.create({ data: { userId: user.id, seasonId: season.id } })
    await db.challengeEvaluation.create({ data: { userChallengeId: enrollment.id, matchId: match.id, status: 'PASS' } })
    await assert.rejects(db.challengeEvaluation.create({ data: {
      userChallengeId: enrollment.id, matchId: match.id, status: 'PASS',
    } }), { code: 'P2002' })
    await assert.rejects(db.challengeRule.create({ data: {
      challengeId: challenge.id, metric: 'kills', operator: 'GTE', booleanValue: true,
    } }), { code: 'P2039' })

    const grant = () => db.$transaction(async (tx) => {
      await tx.rewardLedger.create({ data: {
        userChallengeId: enrollment.id, userId: user.id, seasonId: season.id, xp: 100, seasonPoints: 10,
      } })
      await tx.user.update({ where: { id: user.id }, data: { totalXp: { increment: 100 } } })
      await tx.seasonScore.update({ where: { userId_seasonId: { userId: user.id, seasonId: season.id } }, data: { points: { increment: 10 } } })
    })
    await grant()
    await assert.rejects(grant(), { code: 'P2002' })
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).totalXp, 100)
    assert.equal((await db.seasonScore.findUniqueOrThrow({ where: {
      userId_seasonId: { userId: user.id, seasonId: season.id },
    } })).points, 10)
  } finally {
    await db.challengeEvaluation.deleteMany({ where: { userChallengeId: enrollment.id } })
    await db.rewardLedger.deleteMany({ where: { userChallengeId: enrollment.id } })
    await db.userChallenge.delete({ where: { id: enrollment.id } })
    await db.playerMatchStats.deleteMany({ where: { matchId: match.id } })
    await db.match.delete({ where: { id: match.id } })
    await db.challenge.delete({ where: { id: challenge.id } })
    await db.seasonScore.deleteMany({ where: { userId: user.id } })
    await db.season.delete({ where: { id: season.id } })
    await db.season.delete({ where: { id: activeSeason.id } })
    await db.user.delete({ where: { id: user.id } })
  }
})
