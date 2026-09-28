const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
// Health and HTTP infrastructure tests intentionally use no live database.
process.env.DATABASE_URL ??= 'postgresql://localhost:5432/aegis_tests'
process.env.NODE_ENV = 'test'
process.env.SESSION_SECRET ??= 'integration-test-session-secret-0000000000'

const { IsString } = require('class-validator')
const { BadRequestException, InternalServerErrorException } = require('@nestjs/common')
const { createApplication, createValidationPipe } = require('../dist/bootstrap')
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

test('challenge routes validate input and require the authentication boundary', async () => {
  const id = '00000000-0000-4000-8000-000000000001'
  assert.equal((await fetch(`${baseUrl}/api/challenges?page=0`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges?limit=51`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges?mode=invalid`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges/invalid/activate`, { method: 'POST' })).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/challenges/${id}/activate`, { method: 'POST' })).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/challenges/${id}/activate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activatedAt: new Date().toISOString() }),
  })).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/me/challenges`)).status, 401)
  assert.equal((await fetch(`${baseUrl}/api/me/challenges/${id}`, { method: 'DELETE' })).status, 401)
})

test('environment supplies defaults and validates the database URL, port, host and mode', () => {
  const databaseEnv = { DATABASE_URL: 'postgresql://localhost:5432/aegis_tests' }
  assert.equal(validateEnvironment(databaseEnv).API_PORT, 3000)
  assert.equal(validateEnvironment({ ...databaseEnv, API_PORT: '3100' }).API_PORT, 3100)
  for (const DATABASE_URL of ['', 'mysql://localhost/db', 'postgresql:///db']) {
    assert.throws(() => validateEnvironment({ DATABASE_URL }), /DATABASE_URL/)
  }
  for (const API_PORT of ['', 'abc', '1.5', '0', '-1', '65536']) {
    assert.throws(() => validateEnvironment({ ...databaseEnv, API_PORT }), /API_PORT/)
  }
  assert.throws(() => validateEnvironment({ ...databaseEnv, API_HOST: '' }), /API_HOST/)
  assert.throws(() => validateEnvironment({ ...databaseEnv, NODE_ENV: 'invalid' }), /NODE_ENV/)
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
