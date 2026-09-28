const assert = require('node:assert/strict')
const { test } = require('node:test')
const { Prisma } = require('../dist/database/generated/client')
const { AuthController } = require('../dist/auth/auth.controller')
const { AuthGuard, RoleGuard } = require('../dist/auth/auth.guards')
const { AuthService } = require('../dist/auth/auth.service')
const { steamIdentityFromClaimedIdentifier } = require('../dist/auth/steam-openid.provider')
const { getAccountId32, toCurrentUser, UsersService } = require('../dist/users/users.service')

const steamId = '76561198000000000'
const userRecord = {
  id: 'user-1', steamId64: steamId, accountId32: 39734272n,
  displayName: 'Steam player', avatarUrl: null, role: 'USER', totalXp: 0,
}

test('Steam identity comes from the validated claimed identifier and account ID stays precise', () => {
  assert.deepEqual(steamIdentityFromClaimedIdentifier(`https://steamcommunity.com/openid/id/${steamId}`), { steamId64: steamId })
  assert.throws(() => steamIdentityFromClaimedIdentifier('https://attacker.example/id/76561198000000000'), /invalid identity/)
  assert.equal(getAccountId32(steamId), 39734272n)
  assert.equal(Number(getAccountId32(steamId)), 39734272)
  assert.throws(() => getAccountId32('90071992547409930'), /Invalid SteamID64/)
})

test('successful OpenID identity handling creates the account only after provider verification', async () => {
  const identity = steamIdentityFromClaimedIdentifier(`https://steamcommunity.com/openid/id/${steamId}`)
  const provider = { verifyCallback: async (_request, state) => {
    assert.equal(state, 'verified-state')
    return identity
  } }
  let received
  const users = { findOrCreateFromSteam: async (value) => { received = value; return userRecord } }
  const config = { get: () => undefined }
  const service = new AuthService(provider, users, config)
  assert.equal(await service.authenticateSteam({}, 'verified-state'), userRecord.id)
  assert.deepEqual(received, identity)
})

test('duplicate login uses the unique-key upsert and concurrent unique races resolve to the existing row', async () => {
  const rows = new Map()
  let creates = 0
  const prisma = { user: {
    async upsert(args) {
      const old = rows.get(args.where.steamId64)
      if (old) return { ...old, ...args.update }
      creates += 1
      const created = { ...userRecord, ...args.create }
      rows.set(args.where.steamId64, created)
      return created
    },
    async findUnique(args) { return rows.get(args.where.steamId64) ?? null },
  } }
  const users = new UsersService(prisma)
  const first = await users.findOrCreateFromSteam({ steamId64: steamId, displayName: 'Player' })
  const second = await users.findOrCreateFromSteam({ steamId64: steamId, displayName: 'Player' })
  assert.equal(creates, 1)
  assert.equal(first.id, second.id)
  assert.equal(rows.size, 1)

  const concurrentPrisma = { user: {
    async upsert() { throw new Prisma.PrismaClientKnownRequestError('unique conflict', { code: 'P2002', clientVersion: 'test' }) },
    async findUnique() { return userRecord },
  } }
  assert.equal((await new UsersService(concurrentPrisma).findOrCreateFromSteam({ steamId64: steamId })).id, userRecord.id)
})

test('valid Steam callback rotates and saves the server-side authenticated session', async () => {
  const redirects = []
  let saved = false
  const session = {
    steamLoginState: 'csrf-state',
    regenerate(callback) { delete this.steamLoginState; callback(null) },
    save(callback) { saved = true; callback(null) },
  }
  const auth = {
    async authenticateSteam(_request, state) { assert.equal(state, 'csrf-state'); return userRecord.id },
    frontendRedirect: (result) => `http://localhost:5173/${result}`,
  }
  const controller = new AuthController(auth, {})
  await controller.steamCallback({ query: { state: 'csrf-state' }, session }, { redirect: (...args) => redirects.push(args) })
  assert.equal(session.userId, userRecord.id)
  assert.equal(saved, true)
  assert.deepEqual(redirects, [[302, 'http://localhost:5173/success']])
})

test('invalid callback state never reaches Steam verification or user creation', async () => {
  let verified = false
  const redirects = []
  const controller = new AuthController({
    authenticateSteam: async () => { verified = true },
    frontendRedirect: () => 'http://localhost:5173/?steamAuth=failed',
  }, {})
  await controller.steamCallback({ query: { state: 'attacker-state' }, session: { steamLoginState: 'expected' } }, {
    redirect: (...args) => redirects.push(args),
  })
  assert.equal(verified, false)
  assert.deepEqual(redirects, [[302, 'http://localhost:5173/?steamAuth=failed']])
})

test('failed Steam verification redirects safely without authenticating a user', async () => {
  const redirects = []
  const controller = new AuthController({
    authenticateSteam: async () => { throw new Error('private verification detail') },
    frontendRedirect: () => 'http://localhost:5173/?steamAuth=failed',
  }, {})
  const request = { query: { state: 'valid-state' }, session: { steamLoginState: 'valid-state' } }
  await controller.steamCallback(request, { redirect: (...args) => redirects.push(args) })
  assert.equal(request.session.userId, undefined)
  assert.deepEqual(redirects, [[302, 'http://localhost:5173/?steamAuth=failed']])
})

test('logout destroys sessions and emits the configured cookie clearing attributes', async () => {
  let destroyed = 0
  let cleared
  const configValues = {
    APP_URL: 'http://localhost:5173', SESSION_COOKIE_NAME: 'aegis.sid', SESSION_COOKIE_PATH: '/',
    SESSION_COOKIE_DOMAIN: undefined, NODE_ENV: 'test',
  }
  const config = { getOrThrow: (key) => configValues[key], get: (key) => configValues[key] }
  const controller = new AuthController({}, config)
  const request = { get: () => 'http://localhost:5173', session: { destroy(callback) { destroyed += 1; callback(null) } } }
  const response = { clearCookie: (...args) => { cleared = args } }
  await controller.logout(request, response)
  await controller.logout(request, response)
  assert.equal(destroyed, 2)
  assert.equal(cleared[0], 'aegis.sid')
  assert.deepEqual(cleared[1], { path: '/', sameSite: 'lax', secure: false, httpOnly: true })
})

test('authentication guard loads a safe public user and rejects expired or invalid session identities', async () => {
  const guard = new AuthGuard({ findById: async (id) => id === userRecord.id ? userRecord : null })
  const request = { session: { userId: userRecord.id } }
  const context = { switchToHttp: () => ({ getRequest: () => request }) }
  assert.equal(await guard.canActivate(context), true)
  assert.deepEqual(request.currentUser, toCurrentUser(userRecord))
  assert.equal(request.currentUser.accountId32, 39734272)
  await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ session: {} }) }) }), { status: 401 })
  const invalidRequest = { session: { userId: 'expired-user' } }
  await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => invalidRequest }) }), { status: 401 })
  assert.equal(invalidRequest.session.userId, undefined)
})

test('authenticated /api/me controller returns only the public current-user DTO', async () => {
  const controller = new AuthController({}, {})
  const dto = toCurrentUser(userRecord)
  assert.deepEqual(await controller.me(dto), {
    id: 'user-1', steamId64: steamId, accountId32: 39734272,
    displayName: 'Steam player', avatarUrl: null, role: 'USER', totalXp: 0,
  })
})

test('role guard allows ADMIN and denies USER for an admin route', () => {
  const guard = new RoleGuard({ getAllAndOverride: () => ['ADMIN'] })
  const contextFor = (role) => ({
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ currentUser: { role } }) }),
  })
  assert.equal(guard.canActivate(contextFor('ADMIN')), true)
  assert.throws(() => guard.canActivate(contextFor('USER')), { status: 403 })
})
