require('reflect-metadata')
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { Module, UnauthorizedException, ValidationPipe } = require('@nestjs/common')
const { NestFactory } = require('@nestjs/core')
const { AuthGuard } = require('../dist/auth/auth.guards')
const { UsersService } = require('../dist/users/users.service')
const { LeaderboardController, PublicProfilesController, SeasonsController } = require('../dist/rankings/rankings.controller')
const { RankingsService } = require('../dist/rankings/rankings.service')
const { MatchHistoryController } = require('../dist/matches/match-history.controller')
const { MatchHistoryService } = require('../dist/matches/match-history.service')

const owner = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'

test('read endpoints enforce public/private access and bounded query validation', async () => {
  const observed = []
  const ranking = {
    currentSeason: async () => ({ id: 'season-1' }),
    leaderboard: async query => { observed.push(['leaderboard', query]); return { items: [], ...query } },
    publicProfile: async id => { observed.push(['profile', id]); return { id, displayName: 'Public' } },
  }
  const history = { listMine: async (userId, query) => {
    observed.push(['history', userId, query])
    return { items: [], page: query.page, limit: query.limit, hasMore: false }
  } }
  class TestModule {}
  Module({
    controllers: [SeasonsController, LeaderboardController, PublicProfilesController, MatchHistoryController],
    providers: [
      { provide: RankingsService, useValue: ranking },
      { provide: MatchHistoryService, useValue: history },
      { provide: UsersService, useValue: {} },
      AuthGuard,
    ],
  })(TestModule)
  const app = await NestFactory.create(TestModule, { logger: false })
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  app.get(AuthGuard).canActivate = context => {
    const request = context.switchToHttp().getRequest()
    const id = request.headers['x-test-user-id']
    if (id !== owner && id !== other) throw new UnauthorizedException('Authentication required')
    request.currentUser = { id }
    return true
  }
  try {
    await app.listen(0, '127.0.0.1')
    const base = await app.getUrl()
    const get = (path, userId) => fetch(`${base}/api${path}`, {
      headers: userId ? { 'x-test-user-id': userId } : {},
    })
    assert.equal((await get('/seasons/current')).status, 200)
    assert.equal((await get(`/users/${owner}/profile`)).status, 200)
    assert.deepEqual(observed.find(([name]) => name === 'profile'), ['profile', owner])
    assert.equal((await get('/me/matches')).status, 401)
    assert.equal((await get('/me/matches', owner)).status, 200)
    assert.equal((await get('/me/matches', other)).status, 200)
    assert.deepEqual(observed.filter(([name]) => name === 'history').map(([, id]) => id), [owner, other])
    assert.equal((await get('/leaderboard?page=2&limit=5')).status, 200)
    const query = observed.find(([name]) => name === 'leaderboard')[1]
    assert.deepEqual([query.page, query.limit], [2, 5])
    for (const path of [
      '/leaderboard?limit=51', '/leaderboard?limit=0', '/leaderboard?page=1001',
      '/leaderboard?page=1.5', '/me/matches?limit=1000000', '/me/matches?page=-1',
    ]) {
      assert.equal((await get(path, owner)).status, 400, path)
    }
  } finally {
    await app.close()
  }
})
