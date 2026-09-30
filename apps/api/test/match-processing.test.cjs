const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { before, after, test } = require('node:test')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('../dist/database/generated/client')
const { MatchProcessingService } = require('../dist/matches/match-processing.service')
const { levelForXp } = require('../dist/matches/level')

test('level boundaries use the greatest reached XP threshold', () => {
  const thresholds = [
    { level: 3, requiredTotalXp: 200, rankName: 'C' },
    { level: 1, requiredTotalXp: 0, rankName: 'A' },
    { level: 2, requiredTotalXp: 100, rankName: 'B' },
  ]
  assert.equal(levelForXp(0, thresholds).level, 1)
  assert.equal(levelForXp(99, thresholds).level, 1)
  assert.equal(levelForXp(100, thresholds).level, 2)
  assert.equal(levelForXp(199, thresholds).level, 2)
  assert.equal(levelForXp(200, thresholds).level, 3)
  assert.equal(levelForXp(999, thresholds).level, 3)
  assert.equal(levelForXp(0, []), null)
  assert.throws(() => levelForXp(-1, thresholds), RangeError)
})

const url = process.env.TEST_DATABASE_URL
let db
before(async () => {
  if (!url) return
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
  await db.$connect()
})
after(async () => { await db?.$disconnect() })

test('match pipeline persists, evaluates and grants exactly once against PostgreSQL',
  url ? {} : { skip: 'Set TEST_DATABASE_URL to a disposable migrated PostgreSQL database' }, async () => {
    const users = []
    const challenges = []
    const matches = []
    const seasonId = randomUUID()
    const providerMatches = new Map()
    const provider = {
      getMatch: async (id) => {
        const match = providerMatches.get(id)
        if (!match) throw new Error('Unknown test match')
        return match
      },
      getPlayerMatches: async (accountId) => [...providerMatches.values()]
        .filter(m => m.players.some(p => p.accountId === accountId)).reverse(),
    }
    const service = new MatchProcessingService(db, provider)
    let counter = 0
    const stamp = Date.now().toString().slice(-9)
    const makeUser = async () => {
      const user = await db.user.create({ data: {
        id: randomUUID(), steamId64: `765${stamp}${++counter}`,
        accountId32: BigInt(2000000000 + Number(stamp) + counter), displayName: 'Pipeline test',
      } })
      users.push(user)
      return user
    }
    const makeChallenge = async (user, mode, activatedAt, options = {}) => {
      const challenge = await db.challenge.create({ data: {
        id: randomUUID(), title: 'Pipeline test', description: 'test', category: 'test',
        difficulty: 'EASY', mode, publicationStatus: 'PUBLISHED',
        xpReward: options.xp ?? 100, seasonPointsReward: options.points ?? 10,
        allowedMatchModes: options.allowed ?? [],
        rules: { create: { metric: 'kills', operator: 'GTE', numberValue: options.kills ?? 2 } },
      } })
      challenges.push(challenge)
      return db.userChallenge.create({ data: { userId: user.id, challengeId: challenge.id, activatedAt } })
    }
    const makeMatch = (user, startedAt, options = {}) => {
      const id = `${stamp}${++counter}`
      const gameModeId = options.mode ?? 22
      const lobbyTypeId = options.lobby ?? (gameModeId === 1 ? 0 : 7)
      const match = {
        id, startedAt, durationSeconds: options.duration === undefined ? 1800 : options.duration,
        gameMode: options.unsupported ? 'UNSUPPORTED' : lobbyTypeId === 7 ? 'RANKED' : 'ALL_PICK',
        players: [{ accountId: Number(user.accountId32), win: true,
          kills: options.kills === undefined ? 3 : options.kills,
          deaths: 1, assists: 4, lastHits: 50, heroDamage: 5000,
          towerDamage: 100, wardsPlaced: 1, heroId: 1 }],
        source: { provider: 'OPENDOTA', gameModeId, lobbyTypeId, rawPayload: { id } },
      }
      if (options.missingKills) delete match.players[0].kills
      if (options.duration === null) delete match.durationSeconds
      providerMatches.set(id, match)
      matches.push(id)
      return match
    }
    const process = (user, match) => service.processMatch(user.id, match.id)
    const enrollment = async (id) => db.userChallenge.findUniqueOrThrow({ where: { id } })
    const evaluations = async (id) => db.challengeEvaluation.findMany({ where: { userChallengeId: id } })

    try {
      await db.season.create({ data: { id: seasonId, name: 'Pipeline test',
        startsAt: new Date('2026-05-01'), endsAt: new Date('2027-01-01'), status: 'ENDED' } })
      const activation = new Date('2026-06-01T12:00:00.000Z')
      const beforeActivation = new Date(activation.getTime() - 1000)
      const afterActivation = new Date(activation.getTime() + 1000)

      const user = await makeUser()
      const rankA = await makeChallenge(user, 'SINGLE_MATCH', activation, { allowed: [22] })
      const rankB = await makeChallenge(user, 'PERSISTENT', activation, { allowed: [22] })
      await process(user, makeMatch(user, beforeActivation))
      await process(user, makeMatch(user, activation))
      assert.equal((await evaluations(rankA.id)).length, 0)
      assert.equal((await evaluations(rankB.id)).length, 0)
      const turbo = makeMatch(user, afterActivation, { mode: 23, unsupported: true })
      const lobby = makeMatch(user, afterActivation, { mode: 1, lobby: 1, unsupported: true })
      await process(user, turbo)
      await process(user, lobby)
      assert.equal((await evaluations(rankA.id)).length, 0)
      const winner = makeMatch(user, new Date(activation.getTime() + 2000))
      await Promise.all([process(user, winner), process(user, winner), process(user, winner)])
      assert.equal((await enrollment(rankA.id)).status, 'SUCCEEDED')
      assert.equal((await enrollment(rankB.id)).status, 'SUCCEEDED')
      assert.equal((await evaluations(rankA.id)).length, 1)
      assert.equal((await evaluations(rankB.id)).length, 1)
      assert.equal(await db.match.count({ where: { id: winner.id } }), 1)
      assert.equal((await db.match.findUniqueOrThrow({ where: { id: winner.id } })).provider, 'OPENDOTA')
      assert.equal(await db.playerMatchStats.count({ where: { matchId: winner.id } }), 1)
      assert.deepEqual((await db.match.findUniqueOrThrow({ where: { id: winner.id } })).rawPayload, { id: winner.id })
      assert.equal(await db.rewardLedger.count({ where: { userId: user.id } }), 2)
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).totalXp, 200)
      assert.equal((await db.seasonScore.findUniqueOrThrow({ where: {
        userId_seasonId: { userId: user.id, seasonId },
      } })).points, 20)
      await process(user, winner)
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).totalXp, 200)

      const persistentUser = await makeUser()
      const persistent = await makeChallenge(persistentUser, 'PERSISTENT', activation)
      const fail = makeMatch(persistentUser, afterActivation, { kills: 0 })
      await process(persistentUser, fail)
      assert.equal((await enrollment(persistent.id)).status, 'ACTIVE')
      assert.equal((await enrollment(persistent.id)).attemptsChecked, 1)
      await process(persistentUser, fail)
      assert.equal((await enrollment(persistent.id)).attemptsChecked, 1)
      await process(persistentUser, makeMatch(persistentUser, new Date(activation.getTime() + 2000)))
      assert.equal((await enrollment(persistent.id)).status, 'SUCCEEDED')
      assert.equal((await enrollment(persistent.id)).attemptsChecked, 2)

      const singleUser = await makeUser()
      const single = await makeChallenge(singleUser, 'SINGLE_MATCH', activation)
      await process(singleUser, makeMatch(singleUser, afterActivation, { kills: 0 }))
      assert.equal((await enrollment(single.id)).status, 'FAILED')
      await process(singleUser, makeMatch(singleUser, new Date(activation.getTime() + 2000)))
      assert.equal((await evaluations(single.id)).length, 1)
      assert.equal(await db.rewardLedger.count({ where: { userId: singleUser.id } }), 0)

      const pendingUser = await makeUser()
      const pending = await makeChallenge(pendingUser, 'SINGLE_MATCH', activation)
      const incomplete = makeMatch(pendingUser, afterActivation, { missingKills: true, duration: null })
      await process(pendingUser, incomplete)
      assert.equal((await enrollment(pending.id)).status, 'ACTIVE')
      assert.equal((await enrollment(pending.id)).attemptsChecked, 0)
      assert.equal((await evaluations(pending.id))[0].status, 'PENDING')
      await process(pendingUser, makeMatch(pendingUser, new Date(activation.getTime() + 2000)))
      assert.equal((await evaluations(pending.id)).length, 1)
      incomplete.players[0].kills = 3
      await process(pendingUser, incomplete)
      assert.equal((await evaluations(pending.id)).length, 1)
      assert.equal((await evaluations(pending.id))[0].status, 'PASS')
      assert.equal((await enrollment(pending.id)).attemptsChecked, 1)
      assert.equal((await enrollment(pending.id)).status, 'SUCCEEDED')

      const allPickUser = await makeUser()
      const allPick = await makeChallenge(allPickUser, 'SINGLE_MATCH', activation, { allowed: [1] })
      await process(allPickUser, makeMatch(allPickUser, afterActivation, { mode: 1 }))
      assert.equal((await enrollment(allPick.id)).status, 'SUCCEEDED')

      const orderedUser = await makeUser()
      const ordered = await makeChallenge(orderedUser, 'SINGLE_MATCH', activation)
      makeMatch(orderedUser, afterActivation, { kills: 0 })
      makeMatch(orderedUser, new Date(activation.getTime() + 2000))
      await service.processPlayerMatches(orderedUser.id)
      assert.equal((await enrollment(ordered.id)).status, 'FAILED')
      assert.equal((await evaluations(ordered.id)).length, 1)

      const stranger = await makeUser()
      const foreignMatch = makeMatch(user, new Date(activation.getTime() + 3000))
      await assert.rejects(process(stranger, foreignMatch), /does not belong/)
      assert.equal(await db.match.count({ where: { id: foreignMatch.id } }), 0)

      const rollbackUser = await makeUser()
      const rollback = await makeChallenge(rollbackUser, 'SINGLE_MATCH', activation)
      await db.user.update({ where: { id: rollbackUser.id }, data: { totalXp: 2147483640 } })
      const rollbackMatch = makeMatch(rollbackUser, afterActivation)
      await assert.rejects(process(rollbackUser, rollbackMatch))
      assert.equal((await enrollment(rollback.id)).status, 'ACTIVE')
      assert.equal((await evaluations(rollback.id)).length, 0)
      assert.equal(await db.rewardLedger.count({ where: { userId: rollbackUser.id } }), 0)
      assert.equal((await db.user.findUniqueOrThrow({ where: { id: rollbackUser.id } })).totalXp, 2147483640)
    } finally {
      const userIds = users.map(u => u.id)
      await db.challengeEvaluation.deleteMany({ where: { userChallenge: { userId: { in: userIds } } } })
      await db.rewardLedger.deleteMany({ where: { userId: { in: userIds } } })
      await db.userChallenge.deleteMany({ where: { userId: { in: userIds } } })
      await db.playerMatchStats.deleteMany({ where: { userId: { in: userIds } } })
      await db.match.deleteMany({ where: { id: { in: matches } } })
      await db.challenge.deleteMany({ where: { id: { in: challenges.map(c => c.id) } } })
      await db.seasonScore.deleteMany({ where: { userId: { in: userIds } } })
      await db.user.deleteMany({ where: { id: { in: userIds } } })
      await db.season.deleteMany({ where: { id: seasonId } })
    }
  })
