const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { test } = require('node:test')
const { StratzMatchProvider, StratzProviderError } = require('../dist/integrations/stratz/stratz.provider')
const { StratzMalformedResponseError, normalizeGameMode } = require('../dist/integrations/stratz/stratz.normalize')

function fixture(name) {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', 'stratz', `${name}.json`), 'utf8'))
}

function mockProvider(...responses) {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) })
    const result = responses.shift()
    if (result instanceof Error) throw result
    if (result instanceof Response) return result
    return Response.json(result)
  }
  return { provider: new StratzMatchProvider({ token: 'test-token', fetchImpl }), requests }
}

test('ranked fixture normalizes stats, win/loss, duration, hero and kill participation', async () => {
  const payload = fixture('ranked')
  const { provider, requests } = mockProvider(payload)
  const match = await provider.getMatch('9000000100')
  assert.equal(match.id, '9000000100')
  assert.equal(match.startedAt.toISOString(), new Date(1780000000 * 1000).toISOString())
  assert.equal(match.durationSeconds, 2450)
  assert.equal(match.gameMode, 'RANKED')
  assert.equal(match.source.provider, 'STRATZ')
  assert.equal(match.source.gameModeId, 22)
  assert.equal(match.source.lobbyTypeId, 7)
  assert.deepEqual(match.source.rawPayload, payload.data.match)
  assert.deepEqual(match.players.map(({ accountId, win }) => [accountId, win]), [[1001, true], [1002, false]])
  assert.equal(match.players[0].heroId, 19)
  assert.equal(match.players[0].kills, 10)
  assert.equal(match.players[0].deaths, 3)
  assert.equal(match.players[0].assists, 15)
  assert.equal(match.players[0].lastHits, 180)
  assert.equal(match.players[0].heroDamage, 24500)
  assert.equal(match.players[0].towerDamage, 4100)
  assert.equal(match.players[0].wardsPlaced, 2)
  assert.equal(match.players[0].teamKills, 30)
  assert.equal(match.players[0].killParticipation, 25 / 30)
  assert.equal(match.players[0].duration, 2450)
  assert.equal(match.players[1].wardsPlaced, 0)
  assert.equal(match.players[1].kills, 0)
  assert.equal(match.players[1].killParticipation, 6 / 18)
  assert.equal(requests[0].url, 'https://api.stratz.com/graphql')
  assert.equal(requests[0].options.headers.authorization, 'Bearer test-token')
  assert.equal(requests[0].options.headers['user-agent'], 'STRATZ_API')
  assert.equal(requests[0].body.variables.matchId, 9000000100)
  assert.match(requests[0].body.query, /match\(id: \$matchId\)/)
})

test('All Pick is allowed; Turbo, bots, lobby and unknown modes are unsupported', async () => {
  const { provider } = mockProvider(fixture('all-pick'), fixture('turbo'))
  const allPick = await provider.getMatch('9000000101')
  assert.equal(allPick.gameMode, 'ALL_PICK')
  assert.equal(allPick.players[0].heroId, 42)
  assert.equal(allPick.players[0].win, false)
  assert.equal(allPick.players[0].killParticipation, 12 / 24)
  assert.equal((await provider.getMatch('9000000102')).gameMode, 'UNSUPPORTED')
  assert.equal(normalizeGameMode(1, 4, 5), 'UNSUPPORTED')
  assert.equal(normalizeGameMode(1, 1, 10), 'UNSUPPORTED')
  assert.equal(normalizeGameMode(1, 0, 5), 'UNSUPPORTED')
  assert.equal(normalizeGameMode(1, 0, undefined), 'UNSUPPORTED')
  assert.equal(normalizeGameMode(undefined, 7, 10), 'UNSUPPORTED')
  assert.equal(normalizeGameMode(1, 7, 10), 'RANKED')
})

test('missing stats remain missing while explicit zero stays zero', async () => {
  const { provider } = mockProvider(fixture('missing-stats'))
  const match = await provider.getMatch('9000000103')
  const player = match.players[0]
  assert.equal(match.durationSeconds, undefined)
  assert.equal(player.duration, undefined)
  assert.equal(player.win, undefined)
  assert.equal(player.deaths, undefined)
  assert.equal(player.lastHits, undefined)
  assert.equal(player.heroDamage, undefined)
  assert.equal(player.wardsPlaced, undefined)
  assert.equal(player.killParticipation, undefined)
  assert.equal(player.kills, 0)
  assert.equal(player.assists, 0)
  assert.equal(player.towerDamage, 0)
})

test('malformed fixture, invalid JSON and partial GraphQL envelope are rejected', async () => {
  const { provider } = mockProvider(fixture('malformed'), new Response('not JSON'), { data: null })
  await assert.rejects(provider.getMatch('9000000104'), StratzMalformedResponseError)
  await assert.rejects(provider.getMatch('9000000104'), StratzMalformedResponseError)
  await assert.rejects(provider.getMatch('9000000104'), StratzMalformedResponseError)
})

test('GraphQL errors win over partial data and never echo upstream messages', async () => {
  const { provider } = mockProvider(fixture('graphql-error'))
  await assert.rejects(provider.getMatch('9000000100'), (error) => {
    assert.equal(error.code, 'GRAPHQL_ERROR')
    assert.equal(error.retryable, false)
    assert.doesNotMatch(error.message, /Sanitized upstream/)
    return true
  })
})

test('missing player and missing match have typed NOT_FOUND errors', async () => {
  const { provider } = mockProvider(fixture('player-not-found'), { data: { match: null } })
  await assert.rejects(provider.getPlayerMatches(1001), { code: 'NOT_FOUND', retryable: false })
  await assert.rejects(provider.getMatch('9000000100'), { code: 'NOT_FOUND', retryable: false })
})

test('pagination uses descending match IDs and stops at the incremental cursor', async () => {
  const spec = fixture('pagination')
  const pages = spec.pages.map((ids) => ({ data: { player: { matches: ids.map((id) => ({
    id,
    startDateTime: id === 199 ? null : 1780000000,
    gameMode: 1,
    lobbyType: 0,
    players: [{ steamAccountId: spec.accountId }],
  })) } } }))
  const { provider, requests } = mockProvider(...pages)
  const matches = await provider.getPlayerMatches(spec.accountId, spec.afterMatchId)
  assert.equal(matches.length, 51)
  assert.deepEqual(matches.map((match) => match.id), [...spec.pages[0], 200].map(String))
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(({ body }) => body.variables.request), [
    { take: 50, orderBy: 'DESC' },
    { take: 50, orderBy: 'DESC', before: 201 },
  ])
  assert.equal(requests[0].body.variables.accountId, spec.accountId)
})

test('initial sync is bounded to one page and non-descending pages fail', async () => {
  const raw = fixture('ranked').data.match
  const page = { data: { player: { matches: [raw] } } }
  const first = mockProvider(page)
  assert.deepEqual((await first.provider.getPlayerMatches(1001)).map((match) => match.id), ['9000000100'])
  assert.equal(first.requests.length, 1)
  const second = mockProvider({ data: { player: { matches: [raw, raw] } } })
  await assert.rejects(second.provider.getPlayerMatches(1001), StratzMalformedResponseError)
})

test('rate limit, HTTP, timeout, and missing token have typed failures', async () => {
  const limited = mockProvider(new Response('', { status: 429, headers: { 'retry-after': '3' } }))
  await assert.rejects(limited.provider.getMatch('9000000100'), (error) => {
    assert.equal(error.code, 'RATE_LIMITED')
    assert.equal(error.retryable, true)
    assert.equal(error.retryAfterMs, 3000)
    return true
  })
  await assert.rejects(mockProvider(new Response('', { status: 503 })).provider.getMatch('9000000100'), {
    code: 'HTTP_ERROR', retryable: true, status: 503,
  })
  await assert.rejects(mockProvider(Object.assign(new Error('timed out'), { name: 'TimeoutError' })).provider.getMatch('9000000100'), {
    code: 'TIMEOUT', retryable: true,
  })
  const unconfigured = new StratzMatchProvider({ token: '', fetchImpl: () => assert.fail('must not fetch') })
  await assert.rejects(unconfigured.getMatch('9000000100'), { code: 'NOT_CONFIGURED' })
  assert.ok(StratzProviderError)
})

test('GraphQL rate-limit errors are retryable even with HTTP 200', async () => {
  const { provider } = mockProvider({ errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATE_LIMITED' } }] })
  await assert.rejects(provider.getMatch('9000000100'), { code: 'RATE_LIMITED', retryable: true })
})

test('the HTTP timeout aborts a stalled STRATZ request', async () => {
  const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  const provider = new StratzMatchProvider({ token: 'test-token', timeoutMs: 100, fetchImpl })
  await assert.rejects(provider.getMatch('9000000100'), { code: 'TIMEOUT', retryable: true })
})
