const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
// Health and HTTP infrastructure tests intentionally use no live database.
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/aegis_tests'
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET ??= 'integration-test-session-secret-0000000000'

const { IsString } = require('class-validator')
const { BadRequestException, InternalServerErrorException, ParseUUIDPipe } = require('@nestjs/common')
const { createApplication, createValidationPipe } = require('../dist/bootstrap')
const { ActivateChallengeBodyDto } = require('../dist/challenges/challenges.dto')
const { validateEnvironment } = require('../dist/config/environment')
const { HttpExceptionFilter } = require('../dist/http-exception.filter')

let app
let baseUrl

before(async () => {
  app = await createApplication()
  app.useLogger(false)
  await app.listen(0, '127.0.0.1')
  baseUrl = await app.getUrl()
})

after(async () => { await app?.close() })

test('health is available under /api and returns the liveness contract', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok', service: 'api' })
  assert.equal((await fetch(`${baseUrl}/health`)).status, 404)
})

test('Swagger UI and OpenAPI describe the prefixed health endpoint', async () => {
  const ui = await fetch(`${baseUrl}/api/docs`)
  assert.equal(ui.status, 200)
  assert.match(await ui.text(), /swagger-ui/)
  const schema = await fetch(`${baseUrl}/api/openapi.json`)
  assert.equal(schema.status, 200)
  const document = await schema.json()
  assert.ok(document.paths['/api/health'].get.responses['200'])
  assert.equal(document.info.title, 'Aegis Trials API')
  assert.deepEqual(document.components.schemas.HealthResponseDto.required, ['status', 'service'])
})

test('unknown endpoints use the JSON error envelope', async () => {
  const response = await fetch(`${baseUrl}/api/missing`)
  assert.equal(response.status, 404)
  const body = await response.json()
  assert.equal(body.statusCode, 404)
  assert.equal(typeof body.message, 'string')
  assert.equal(body.stack, undefined)
})

test('unauthenticated and invalid sessions receive 401 from /api/me', async () => {
  assert.equal((await fetch(`${baseUrl}/api/me`)).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me`, { headers: { cookie: 'aegis.sid=invalid' } })).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me/match-sync-status`)).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me/matches/refresh`, {
    method: 'POST', headers: { origin: 'http://localhost:5173' },
  })).status, 401)
})

test('logout is repeatable and clears the session cookie', async () => {
  const options = { method: 'POST', headers: { origin: 'http://localhost:5173' } }
  const first = await fetch(`${baseUrl}/api/auth/logout`, { ...options, redirect: 'manual' })
  const second = await fetch(`${baseUrl}/api/auth/logout`, { ...options, redirect: 'manual' })
  assert.equal(first.status, 204)
  assert.equal(second.status, 204)
  assert.match(first.headers.get('set-cookie') ?? '', /aegis\.sid=;/)
})

test('invalid Steam callback is redirected to the configured frontend URL', async () => {
  const response = await fetch(`${baseUrl}/api/auth/steam/callback?state=untrusted`, { redirect: 'manual' })
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'http://localhost:5173/?steamAuth=failed')
})

test('challenge routes validate input and require the authentication boundary', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  assert.equal((await fetch(`${baseUrl}/api/challenges?page=0`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges?limit=51`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges?mode=invalid`)).status, 400)
  await assert.rejects(new ParseUUIDPipe().transform('invalid', { type: 'param' }), BadRequestException)
  await assert.rejects(createValidationPipe().transform({ activatedAt: new Date().toISOString() }, {
    type: 'body', metatype: ActivateChallengeBodyDto,
  }), BadRequestException)
  const sameOrigin = { origin: 'http://localhost:5173' }
  assert.equal((await fetch(`${baseUrl}/api/challenges/${id}/activate`, { method: 'POST', headers: sameOrigin })).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me/challenges`)).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me/challenges/${id}`, { method: 'DELETE', headers: sameOrigin })).status, 401)
})

test('state-changing API calls require the configured frontend Origin', async () => {
  const invalid = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { origin: 'https://attacker.example' } })
  const missing = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' })
  assert.equal(invalid.status, 403)
  assert.equal(missing.status, 403)
})

test('environment supplies defaults and validates the database URL, port, host and mode', () => {
  const databaseEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/aegis_tests',
    REDIS_URL: 'redis://localhost:6379',
    NODE_ENV: 'test', SESSION_SECRET: 'unit-test-session-secret-0000000000000000',
  }
  assert.equal(validateEnvironment(databaseEnv).API_PORT, 3000)
  assert.equal(validateEnvironment({ ...databaseEnv, API_PORT: '3100' }).API_PORT, 3100)
  assert.equal(validateEnvironment(databaseEnv).STRATZ_TIMEOUT_MS, 10000)
  assert.equal(validateEnvironment({ ...databaseEnv, STRATZ_TIMEOUT_MS: '2500' }).STRATZ_TIMEOUT_MS, 2500)
  for (const DATABASE_URL of ['', 'mysql://localhost/db', 'postgresql:///db']) {
    assert.throws(() => validateEnvironment({ ...databaseEnv, DATABASE_URL }), /DATABASE_URL/)
  }
  for (const API_PORT of ['', 'abc', '1.5', '0', '-1', '65536']) {
    assert.throws(() => validateEnvironment({ ...databaseEnv, API_PORT }), /API_PORT/)
  }
  assert.throws(() => validateEnvironment({ ...databaseEnv, API_HOST: '' }), /API_HOST/)
  assert.throws(() => validateEnvironment({ ...databaseEnv, STRATZ_TIMEOUT_MS: '0' }), /STRATZ_TIMEOUT_MS/)
  assert.throws(() => validateEnvironment({ ...databaseEnv, NODE_ENV: 'invalid' }), /NODE_ENV/)
  assert.throws(() => validateEnvironment({ ...databaseEnv, SESSION_SECRET: 'short' }), /SESSION_SECRET/)
  assert.throws(() => validateEnvironment({ ...databaseEnv, NODE_ENV: 'production' }), /APP_URL, STEAM_REALM and STEAM_RETURN_URL/)
})

test('validation transforms DTOs and rejects invalid or undeclared fields', async () => {
  class InputDto {}
  IsString()(InputDto.prototype, 'name')
  const metadata = { type: 'body', metatype: InputDto }
  const pipe = createValidationPipe()
  const value = await pipe.transform({ name: 'valid' }, metadata)
  assert.ok(value instanceof InputDto)
  await assert.rejects(pipe.transform({ name: 123 }, metadata), BadRequestException)
  await assert.rejects(pipe.transform({ name: 'valid', extra: true }, metadata), BadRequestException)
})

test('unexpected errors and HTTP 500 errors do not leak internal details', () => {
  let body
  let statusCode
  const filter = new HttpExceptionFilter({ httpAdapter: {
    reply(_response, payload, status) { body = payload; statusCode = status },
  } })
  const host = { switchToHttp: () => ({ getResponse: () => ({}) }) }
  for (const error of [new Error('private database credentials'), new InternalServerErrorException('private token')]) {
    filter.catch(error, host)
    assert.equal(statusCode, 500)
    assert.deepEqual(body, { statusCode: 500, message: 'Internal server error' })
  }
})
