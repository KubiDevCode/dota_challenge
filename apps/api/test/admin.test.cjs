const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/aegis_tests'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET ??= 'integration-test-session-secret-0000000000'
const { BadRequestException, ConflictException, UnauthorizedException } = require('@nestjs/common')
const { Prisma } = require('../dist/database/generated/client')
const { createValidationPipe } = require('../dist/bootstrap')
const { AdminService } = require('../dist/admin/admin.service')
const { AdminModule } = require('../dist/admin/admin.module')
const { AuthGuard } = require('../dist/auth/auth.guards')
const {
  CreateChallengeDto, PatchChallengeDto, ReplaceLevelThresholdsDto, CreateSeasonDto, PatchSeasonDto,
} = require('../dist/admin/admin.dto')

const pipe = createValidationPipe()
const validChallenge = {
  title: 'Win a match', description: 'Play well', category: 'combat', difficulty: 'EASY',
  mode: 'SINGLE_MATCH', xpReward: 100, seasonPointsReward: 10, allowedMatchModes: [1, 22],
  publicationStatus: 'PUBLISHED', availableFrom: '2026-10-01T00:00:00.000Z',
  rules: [{ metric: 'win', operator: 'EQ', value: true }, { metric: 'kills', operator: 'GTE', value: 3 }],
}
const season = { name: 'Autumn', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2026-11-01T00:00:00.000Z', status: 'DRAFT' }
const body = (value, metatype) => pipe.transform(value, { type: 'body', metatype })

test('admin DTOs reject unknown fields, invalid rules, rewards, modes and null patch values', async () => {
  assert.ok(await body(validChallenge, CreateChallengeDto))
  const invalidChallenges = [
    { ...validChallenge, role: 'ADMIN' },
    { ...validChallenge, xpReward: -1 },
    { ...validChallenge, xpReward: 1.5 },
    { ...validChallenge, xpReward: 2147483648 },
    { ...validChallenge, allowedMatchModes: [23] },
    { ...validChallenge, rules: [{ ...validChallenge.rules[0], expression: 'process.exit()' }] },
    { ...validChallenge, rules: [] },
  ]
  for (const value of invalidChallenges) await assert.rejects(body(value, CreateChallengeDto), BadRequestException)
  for (const value of [{ xpReward: null }, { title: null }, { rules: [] }, { rules: [{ metric: 'kills', operator: 'GTE', value: 2, sql: 'DROP TABLE' }] }, { id: 'fake' }]) {
    await assert.rejects(body(value, PatchChallengeDto), BadRequestException)
  }
  await assert.rejects(body({ status: null }, PatchSeasonDto), BadRequestException)
  await assert.rejects(body({ ...season, arbitrary: 'field' }, CreateSeasonDto), BadRequestException)
})

test('rule constructor accepts only shared Rule Engine metric, operator and value combinations', async () => {
  let saved
  const service = new AdminService({ challenge: { create: async (args) => { saved = args; return { id: 'challenge', ...args.data, createdAt: new Date(), updatedAt: new Date(), rules: args.data.rules.create.map((r) => ({ ...r, id: 'rule' })) } } } })
  const created = await service.createChallenge(await body(validChallenge, CreateChallengeDto))
  assert.deepEqual(created.rules, validChallenge.rules)
  assert.deepEqual(saved.data.rules.create, [
    { metric: 'win', operator: 'EQ', numberValue: null, booleanValue: true },
    { metric: 'kills', operator: 'GTE', numberValue: 3, booleanValue: null },
  ])
  await service.createChallenge({ ...validChallenge, rules: [{ metric: 'duration', operator: 'GTE', value: 30.5 }] })
  assert.equal(saved.data.rules.create[0].numberValue, 30.5)
  const badRules = [
    { metric: 'player.stats.kills', operator: 'GTE', value: 2 },
    { metric: 'kills', operator: 'EVAL', value: 2 },
    { metric: 'win', operator: 'GTE', value: true },
    { metric: 'win', operator: 'EQ', value: 1 },
    { metric: 'kills', operator: 'GTE', value: '3' },
    { metric: 'kills', operator: 'GTE', value: -1 },
    { metric: 'heroId', operator: 'LTE', value: 2 },
    { metric: 'killParticipation', operator: 'LTE', value: 1.1 },
    { metric: 'kills', operator: 'GTE', value: 3, javascript: 'return true' },
  ]
  for (const rule of badRules) {
    await assert.rejects(service.createChallenge({ ...validChallenge, rules: [rule] }), BadRequestException)
  }
})

test('threshold replacement validates complete nonambiguous progression and runs atomically', async () => {
  const calls = []
  const db = { $transaction: async (fn) => fn({
    $executeRaw: async () => { calls.push('lock') },
    levelThreshold: {
      deleteMany: async () => { calls.push('delete') },
      createMany: async ({ data }) => { calls.push(data) },
      findMany: async () => { calls.push('read'); return [] },
    },
  }) }
  const service = new AdminService(db)
  const thresholds = [{ level: 2, requiredTotalXp: 100, rankName: 'Scout' }, { level: 1, requiredTotalXp: 0, rankName: 'Recruit' }]
  await service.replaceLevelThresholds(await body({ thresholds }, ReplaceLevelThresholdsDto))
  assert.deepEqual(calls, ['lock', 'delete', [thresholds[1], thresholds[0]], 'read'])
  for (const rows of [
    [{ level: 1, requiredTotalXp: 0, rankName: 'A' }, { level: 1, requiredTotalXp: 10, rankName: 'B' }],
    [{ level: 1, requiredTotalXp: 0, rankName: 'A' }, { level: 2, requiredTotalXp: 0, rankName: 'B' }],
    [{ level: 1, requiredTotalXp: 0, rankName: 'A' }, { level: 3, requiredTotalXp: 10, rankName: 'B' }],
    [{ level: 1, requiredTotalXp: 10, rankName: 'A' }],
  ]) await assert.rejects(service.replaceLevelThresholds({ thresholds: rows }), BadRequestException)
  await assert.rejects(body({ thresholds: [{ level: 1, requiredTotalXp: -1, rankName: 'A' }] }, ReplaceLevelThresholdsDto), BadRequestException)
  assert.equal(calls.length, 4)
})

test('season dates and patches are checked before writes', async () => {
  let writes = 0
  const db = {
    season: { create: async (args) => { writes += 1; return args.data } },
    $transaction: async (fn) => fn({ season: {
      findUnique: async () => ({ ...season, startsAt: new Date(season.startsAt), endsAt: new Date(season.endsAt) }),
      update: async (args) => { writes += 1; return args.data },
    } }),
  }
  const service = new AdminService(db)
  await assert.rejects(service.createSeason({ ...season, endsAt: season.startsAt }), BadRequestException)
  await assert.rejects(service.patchSeason('id', { startsAt: '2026-12-01T00:00:00.000Z' }), BadRequestException)
  await assert.rejects(service.patchSeason('id', {}), BadRequestException)
  assert.equal(writes, 0)
  await service.createSeason(await body(season, CreateSeasonDto))
  await service.patchSeason('id', await body({ name: 'New name' }, PatchSeasonDto))
  assert.equal(writes, 2)
})

test('challenge patch validates rules and replaces them inside one transaction', async () => {
  let update
  const service = new AdminService({ $transaction: async (fn) => fn({ challenge: {
    findUnique: async () => ({ id: 'challenge' }),
    update: async (args) => {
      update = args
      return { id: 'challenge', title: 'Test', description: '', category: 'test', difficulty: 'EASY',
        mode: 'SINGLE_MATCH', xpReward: 5, seasonPointsReward: 0, allowedMatchModes: [],
        publicationStatus: 'DRAFT', availableFrom: null, createdAt: new Date(), updatedAt: new Date(),
        rules: args.data.rules.create.map((rule) => ({ ...rule, id: 'rule' })) }
    },
  } }) })
  await assert.rejects(service.patchChallenge('challenge', {}), BadRequestException)
  await assert.rejects(service.patchChallenge('challenge', { rules: [{ metric: 'win', operator: 'LTE', value: true }] }), BadRequestException)
  const result = await service.patchChallenge('challenge', await body({ rules: [{ metric: 'deaths', operator: 'LTE', value: 2 }], availableFrom: null }, PatchChallengeDto))
  assert.deepEqual(result.rules, [{ metric: 'deaths', operator: 'LTE', value: 2 }])
  assert.equal(update.data.availableFrom, null)
  assert.deepEqual(update.data.rules, { deleteMany: {}, create: [{ metric: 'deaths', operator: 'LTE', numberValue: 2, booleanValue: null }] })
})

test('simultaneous ACTIVE seasons yield one success and one conflict through the database unique index', async () => {
  const indexSql = readFileSync(join(__dirname, '../../../prisma/migrations/20260928000000_initial/migration.sql'), 'utf8')
  assert.match(indexSql, /CREATE UNIQUE INDEX "Season_one_active_idx" ON "Season" \("status"\) WHERE "status" = 'ACTIVE'/)
  let active = false
  const db = { season: { create: async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, 1))
    if (active) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' })
    active = true
    return data
  } } }
  const service = new AdminService(db)
  const outcomes = await Promise.allSettled([service.createSeason({ ...season, status: 'ACTIVE' }), service.createSeason({ ...season, status: 'ACTIVE' })])
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = outcomes.find((result) => result.status === 'rejected')
  assert.ok(rejected.reason instanceof ConflictException)
})

test('admin routes enforce authentication and DB-derived ADMIN role before access', async () => {
  const { Module } = require('@nestjs/common')
  const { ConfigModule } = require('@nestjs/config')
  const { NestFactory } = require('@nestjs/core')
  const { validateEnvironment } = require('../dist/config/environment')
  class AdminTestApp {}
  Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), AdminModule] })(AdminTestApp)
  const app = await NestFactory.create(AdminTestApp)
  app.useLogger(false)
  app.setGlobalPrefix('api')
  app.useGlobalPipes(createValidationPipe())
  const guard = app.select(AdminModule).get(AuthGuard, { strict: true })
  guard.canActivate = (context) => {
    const request = context.switchToHttp().getRequest()
    // Test-only identity lookup stands in for AuthGuard's database lookup.
    const role = { ordinary: 'USER', moderator: 'ADMIN' }[request.headers['x-test-user-id']]
    if (!role) throw new UnauthorizedException()
    request.currentUser = { id: 'server-user', role }
    return true
  }
  const admin = app.select(AdminModule).get(AdminService, { strict: true })
  admin.listChallenges = async () => []
  admin.listLevelThresholds = async () => []
  admin.listSeasons = async () => []
  admin.createChallenge = async () => ({ id: 'created' })
  admin.patchChallenge = async () => ({ id: 'patched' })
  admin.replaceLevelThresholds = async () => []
  admin.createSeason = async () => ({ id: 'created' })
  admin.patchSeason = async () => ({ id: 'patched' })
  await app.listen(0, '127.0.0.1')
  try {
    const base = await app.getUrl()
    const id = '00000000-0000-4000-8000-000000000001'
    const routes = [
      ['GET', 'challenges', undefined, 200], ['POST', 'challenges', validChallenge, 201],
      ['PATCH', `challenges/${id}`, { title: 'Updated' }, 200],
      ['GET', 'level-thresholds', undefined, 200],
      ['PATCH', 'level-thresholds', { thresholds: [{ level: 1, requiredTotalXp: 0, rankName: 'Recruit' }] }, 200],
      ['GET', 'seasons', undefined, 200], ['POST', 'seasons', season, 201],
      ['PATCH', `seasons/${id}`, { name: 'Updated' }, 200],
    ]
    for (const [method, route, payload, allowedStatus] of routes) {
      const request = (userId) => fetch(`${base}/api/admin/${route}`, {
        method,
        headers: {
          ...(method !== 'GET' ? { origin: 'http://localhost:5173', 'content-type': 'application/json' } : {}),
          ...(userId ? { 'x-test-user-id': userId } : {}),
          'x-test-role': 'ADMIN',
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      })
      assert.equal((await request()).status, 401)
      assert.equal((await request('ordinary')).status, 403)
      assert.equal((await request('moderator')).status, allowedStatus)
    }
  } finally { await app.close() }
})
