const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { test } = require('node:test')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('../dist/database/generated/client')

const url = process.env.TEST_DATABASE_URL

test('challenge HTTP lifecycle and concurrent activation against PostgreSQL',
  url ? {} : { skip: 'Set TEST_DATABASE_URL to a disposable migrated PostgreSQL database' }, async () => {
    process.env.DATABASE_URL = url
    const { createApplication } = require('../dist/bootstrap')
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
    const app = await createApplication()
    app.useLogger(false)
    const users = []
    const challenges = []
    const suffix = `${Date.now()}${Math.floor(Math.random() * 100000)}`
    const makeUser = async (n) => {
      const user = await db.user.create({ data: {
        id: randomUUID(), steamId64: `765${suffix.slice(-15)}${n}`,
        accountId32: BigInt(3000000000 + (Number(suffix.slice(-7)) * 10 + n) % 1000000000),
        displayName: 'Lifecycle test',
      } })
      users.push(user)
      return user
    }
    const makeChallenge = async (title, publicationStatus = 'PUBLISHED', availableFrom = null) => {
      const challenge = await db.challenge.create({ data: {
        id: randomUUID(), title, description: 'Lifecycle test', category: 'test',
        difficulty: 'EASY', mode: 'SINGLE_MATCH', xpReward: 10,
        publicationStatus, availableFrom,
        rules: { create: { metric: 'kills', operator: 'GTE', numberValue: 2 } },
      } })
      challenges.push(challenge)
      return challenge
    }
    try {
      const owner = await makeUser(1)
      const other = await makeUser(2)
      const draft = await makeChallenge('Draft', 'DRAFT')
      const future = await makeChallenge('Future', 'PUBLISHED', new Date(Date.now() + 86400000))
      const available = await Promise.all([1, 2, 3, 4].map(n => makeChallenge(`Available ${n}`)))

      // Test-only middleware stands in for a verified auth middleware. Production has no header-based auth.
      app.use((req, _res, next) => {
        const id = req.headers['x-test-user-id']
        if (id === owner.id || id === other.id) req.user = { id }
        next()
      })
      await app.listen(0, '127.0.0.1')
      const base = await app.getUrl()
      const request = (path, method = 'GET', user = owner) => fetch(`${base}/api${path}`, {
        method, headers: user ? { 'x-test-user-id': user.id } : {},
      })

      const listing = await request('/challenges')
      assert.equal(listing.status, 200)
      const publicItems = (await listing.json()).items
      assert.equal(publicItems.length, 4)
      assert.ok(publicItems.every(c => available.some(a => a.id === c.id)))
      assert.ok(publicItems.every(c => !('publicationStatus' in c) && !('createdAt' in c)))
      assert.deepEqual(publicItems[0].rules[0], { metric: 'kills', operator: 'GTE', value: 2 })
      assert.equal((await request('/challenges?limit=1')).status, 200)
      assert.equal((await request(`/challenges/${available[0].id}/activate`, 'POST', null)).status, 401)
      assert.equal((await request(`/challenges/${randomUUID()}/activate`, 'POST')).status, 404)
      assert.equal((await request(`/challenges/${draft.id}/activate`, 'POST')).status, 409)
      assert.equal((await request(`/challenges/${future.id}/activate`, 'POST')).status, 409)

      const first = await request(`/challenges/${available[0].id}/activate`, 'POST')
      assert.equal(first.status, 201)
      const firstBody = await first.json()
      assert.equal(firstBody.status, 'ACTIVE')
      assert.equal(firstBody.attemptsChecked, 0)
      assert.ok(Date.parse(firstBody.activatedAt) <= Date.now())
      assert.equal((await request(`/challenges/${available[0].id}/activate`, 'POST')).status, 409)
      assert.equal((await request(`/challenges/${available[1].id}/activate`, 'POST')).status, 201)

      const concurrent = await Promise.all([2, 3].map(n => request(`/challenges/${available[n].id}/activate`, 'POST')))
      assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409])
      assert.equal(await db.userChallenge.count({ where: { userId: owner.id, status: 'ACTIVE' } }), 3)
      const mine = await request('/me/challenges')
      assert.equal(mine.status, 200)
      assert.equal((await mine.json()).length, 3)
      assert.equal((await request(`/me/challenges/${firstBody.id}`, 'DELETE', other)).status, 404)
      assert.equal((await request(`/me/challenges/${firstBody.id}`, 'DELETE')).status, 200)
      assert.equal((await request(`/me/challenges/${firstBody.id}`, 'DELETE')).status, 409)

      const completed = await db.userChallenge.create({ data: {
        userId: other.id, challengeId: available[0].id, status: 'SUCCEEDED', completedAt: new Date(),
      } })
      assert.equal((await request(`/me/challenges/${completed.id}`, 'DELETE', other)).status, 409)
      const ownerList = await request('/me/challenges')
      assert.ok((await ownerList.json()).every(row => row.id !== completed.id))
    } finally {
      await app.close()
      await db.userChallenge.deleteMany({ where: { userId: { in: users.map(u => u.id) } } })
      await db.challenge.deleteMany({ where: { id: { in: challenges.map(c => c.id) } } })
      await db.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } })
      await db.$disconnect()
    }
  })
