const assert = require('node:assert/strict')
const { test } = require('node:test')
const { OpenDotaMatchProvider, OpenDotaProviderError, normalizeOpenDotaMatch } = require('../dist/integrations/opendota/opendota.provider')

function fullMatch(overrides = {}) {
  return {
    match_id: 9000000100, start_time: 1780000000, duration: 2450,
    game_mode: 22, lobby_type: 7, human_players: 10, radiant_win: true,
    radiant_score: 30, dire_score: 18,
    players: [
      { account_id: 1001, player_slot: 0, kills: 10, deaths: 3, assists: 15,
        last_hits: 180, hero_damage: 24500, tower_damage: 4100, obs_placed: 2, sen_placed: 3, hero_id: 19 },
      { account_id: 1002, player_slot: 128, kills: 6, deaths: 7, assists: 4,
        last_hits: 80, hero_damage: 12000, tower_damage: 1000, obs_placed: 1, sen_placed: 0, hero_id: 42 },
      { account_id: null, player_slot: 1 },
    ],
    ...overrides,
  }
}

function mockProvider(...responses) {
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url: new URL(url), options })
    const result = responses.shift()
    if (result instanceof Error) throw result
    if (result instanceof Response) return result
    return Response.json(result)
  }
  return { provider: new OpenDotaMatchProvider({ fetchImpl }), requests }
}

test('OpenDota matches normalize game, player stats and source metadata', async () => {
  const payload = fullMatch()
  const { provider, requests } = mockProvider(payload)
  const match = await provider.getMatch('9000000100')
  assert.equal(match.id, '9000000100')
  assert.equal(match.startedAt.toISOString(), new Date(1780000000 * 1000).toISOString())
  assert.equal(match.durationSeconds, 2450)
  assert.equal(match.gameMode, 'RANKED')
  assert.equal(match.source.provider, 'OPENDOTA')
  assert.equal(match.source.gameModeId, 22)
  assert.equal(match.source.lobbyTypeId, 7)
  assert.deepEqual(match.source.rawPayload, payload)
  assert.deepEqual(match.players.map(({ accountId, win }) => [accountId, win]), [[1001, true], [1002, false]])
  assert.equal(match.players[0].heroId, 19)
  assert.equal(match.players[0].kills, 10)
  assert.equal(match.players[0].killParticipation, 25 / 30)
  assert.equal(match.players[0].wardsPlaced, 5)
  assert.equal(match.players[0].duration, 2450)
  assert.equal(requests[0].url.href, 'https://api.opendota.com/api/matches/9000000100')
})

test('only ranked/all-pick full human lobbies are eligible; unknown or bot modes fail closed', () => {
  assert.equal(normalizeOpenDotaMatch(fullMatch()).gameMode, 'RANKED')
  assert.equal(normalizeOpenDotaMatch(fullMatch({ game_mode: 1, lobby_type: 0 })).gameMode, 'ALL_PICK')
  assert.equal(normalizeOpenDotaMatch(fullMatch({ game_mode: 23 })).gameMode, 'UNSUPPORTED')
  assert.equal(normalizeOpenDotaMatch(fullMatch({ human_players: 9 })).gameMode, 'UNSUPPORTED')
  assert.equal(normalizeOpenDotaMatch(fullMatch({ human_players: null })).gameMode, 'UNSUPPORTED')
})

test('missing player metrics remain unavailable, while explicit zero stays zero', () => {
  const match = normalizeOpenDotaMatch(fullMatch({
    duration: null,
    players: [{ account_id: 1001, player_slot: 0, kills: 0, assists: 0, deaths: null, last_hits: null,
      hero_damage: null, tower_damage: 0, obs_placed: null, sen_placed: null, hero_id: null }],
    radiant_score: null,
  }))
  assert.equal(match.durationSeconds, undefined)
  assert.equal(match.players[0].kills, 0)
  assert.equal(match.players[0].deaths, undefined)
  assert.equal(match.players[0].lastHits, undefined)
  assert.equal(match.players[0].towerDamage, 0)
  assert.equal(match.players[0].wardsPlaced, undefined)
  assert.equal(match.players[0].killParticipation, undefined)
})

test('player match history requests recent matches and paginates to the stored cursor', async () => {
  const rows = (first, last) => Array.from({ length: first - last + 1 }, (_, i) => ({
    match_id: first - i, start_time: 1780000000 - i,
  }))
  const { provider, requests } = mockProvider(rows(300, 251), rows(250, 201))
  const matches = await provider.getPlayerMatches(1001, '220')
  assert.equal(matches.length, 80)
  assert.equal(matches[0].id, '300')
  assert.equal(matches.at(-1).id, '221')
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(({ url }) => [url.pathname, url.searchParams.get('limit'), url.searchParams.get('offset'), url.searchParams.get('significant'), url.searchParams.get('sort')]), [
    ['/api/players/1001/matches', '50', '0', '0', 'match_id'],
    ['/api/players/1001/matches', '50', '50', '0', 'match_id'],
  ])
  const initial = mockProvider(rows(300, 251))
  assert.equal((await initial.provider.getPlayerMatches(1001)).length, 50)
  assert.equal(initial.requests.length, 1)
})

test('malformed payloads and invalid player IDs are rejected', async () => {
  assert.throws(() => normalizeOpenDotaMatch({ ...fullMatch(), players: {} }), OpenDotaProviderError)
  const { provider } = mockProvider([])
  await assert.rejects(provider.getPlayerMatches(0), RangeError)
  await assert.rejects(provider.getMatch('not-a-match'), OpenDotaProviderError)
})

test('rate limits, network, HTTP failures and timeout are typed for worker retries', async () => {
  await assert.rejects(mockProvider(new Response('', { status: 429, headers: { 'retry-after': '3' } })).provider.getMatch('9000000100'), (error) => {
    assert.equal(error.code, 'RATE_LIMITED')
    assert.equal(error.retryable, true)
    assert.equal(error.retryAfterMs, 3000)
    return true
  })
  await assert.rejects(mockProvider(new Response('', { status: 503 })).provider.getMatch('9000000100'), {
    code: 'HTTP_ERROR', retryable: true, status: 503,
  })
  await assert.rejects(mockProvider(new Response('', { status: 404 })).provider.getMatch('9000000100'), {
    code: 'NOT_FOUND', retryable: false,
  })
  await assert.rejects(mockProvider(Object.assign(new Error('network'), { name: 'TypeError' })).provider.getMatch('9000000100'), {
    code: 'NETWORK_ERROR', retryable: true,
  })
  const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  })
  const timeout = new OpenDotaMatchProvider({ timeoutMs: 100, fetchImpl })
  await assert.rejects(timeout.getMatch('9000000100'), { code: 'TIMEOUT', retryable: true })
})
