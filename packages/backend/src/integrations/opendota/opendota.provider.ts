import type { MatchProvider, ProviderGameMode, ProviderMatch, ProviderMatchSummary, ProviderPlayerMatch } from '../match-provider'

type JsonRecord = Record<string, unknown>

const API_ROOT = 'https://api.opendota.com/api'
const PAGE_SIZE = 50
const MAX_INCREMENTAL_PAGES = 10

export type OpenDotaErrorCode =
  | 'TIMEOUT' | 'NETWORK_ERROR' | 'HTTP_ERROR' | 'RATE_LIMITED'
  | 'NOT_FOUND' | 'PAGINATION_LIMIT' | 'MALFORMED_RESPONSE'

export class OpenDotaProviderError extends Error {
  constructor(
    readonly code: OpenDotaErrorCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(`OpenDota provider: ${code}${detail ? ` (${detail})` : ''}`)
    this.name = 'OpenDotaProviderError'
  }
}

export interface OpenDotaProviderOptions {
  apiKey?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  apiRoot?: string
}

function record(value: unknown, detail: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OpenDotaProviderError('MALFORMED_RESPONSE', false, undefined, undefined, detail)
  }
  return value as JsonRecord
}

function optionalInteger(value: unknown, detail: string): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new OpenDotaProviderError('MALFORMED_RESPONSE', false, undefined, undefined, detail)
  }
  return value
}

function matchId(value: unknown): string {
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value
  const id = optionalInteger(value, 'invalid match ID')
  if (!id || id <= 0) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
  return String(id)
}

function normalizeMode(gameModeId: number | undefined, lobbyTypeId: number | undefined, humanPlayers: number | undefined): ProviderGameMode {
  if (humanPlayers !== 10) return 'UNSUPPORTED'
  if (lobbyTypeId === 7 && (gameModeId === 22 || gameModeId === 1)) return 'RANKED'
  if (lobbyTypeId === 0 && gameModeId === 1) return 'ALL_PICK'
  return 'UNSUPPORTED'
}

function playerMatch(raw: unknown, match: JsonRecord, durationSeconds: number | undefined): ProviderPlayerMatch | undefined {
  const player = record(raw, 'invalid player')
  const accountId = optionalInteger(player.account_id, 'invalid player account ID')
  if (accountId === undefined || accountId === 0) return undefined
  if (accountId > 0xffffffff) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)

  const slot = optionalInteger(player.player_slot, 'invalid player slot')
  const isRadiant = slot === undefined ? undefined : slot < 128
  const radiantWin = typeof match.radiant_win === 'boolean' ? match.radiant_win : undefined
  const win = isRadiant !== undefined && radiantWin !== undefined ? isRadiant === radiantWin : undefined
  const teamKills = isRadiant === undefined ? undefined : optionalInteger(
    isRadiant ? match.radiant_score : match.dire_score, 'invalid team kill count',
  )
  const kills = optionalInteger(player.kills, 'invalid kills')
  const assists = optionalInteger(player.assists, 'invalid assists')
  let killParticipation: number | undefined
  if (kills !== undefined && assists !== undefined && teamKills !== undefined) {
    if (teamKills > 0 && kills + assists <= teamKills) killParticipation = (kills + assists) / teamKills
    else if (teamKills === 0 && kills + assists === 0) killParticipation = 0
  }
  const obsPlaced = optionalInteger(player.obs_placed, 'invalid observer ward count')
  const sentryPlaced = optionalInteger(player.sen_placed, 'invalid sentry ward count')
  const wardsPlaced = obsPlaced === undefined && sentryPlaced === undefined
    ? undefined : (obsPlaced ?? 0) + (sentryPlaced ?? 0)

  return {
    accountId,
    ...(durationSeconds !== undefined && { duration: durationSeconds }),
    ...(win !== undefined && { win }),
    ...(teamKills !== undefined && { teamKills }),
    ...(killParticipation !== undefined && { killParticipation }),
    ...(wardsPlaced !== undefined && { wardsPlaced }),
    ...(kills !== undefined && { kills }),
    ...(assists !== undefined && { assists }),
    ...(optionalInteger(player.deaths, 'invalid deaths') !== undefined && { deaths: player.deaths as number }),
    ...(optionalInteger(player.last_hits, 'invalid last hits') !== undefined && { lastHits: player.last_hits as number }),
    ...(optionalInteger(player.hero_damage, 'invalid hero damage') !== undefined && { heroDamage: player.hero_damage as number }),
    ...(optionalInteger(player.tower_damage, 'invalid tower damage') !== undefined && { towerDamage: player.tower_damage as number }),
    ...(optionalInteger(player.hero_id, 'invalid hero ID') !== undefined && { heroId: player.hero_id as number }),
  }
}

export function normalizeOpenDotaMatch(raw: unknown): ProviderMatch {
  const match = record(raw, 'invalid match')
  const id = matchId(match.match_id)
  const startTime = optionalInteger(match.start_time, 'invalid start time')
  if (!startTime) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
  const startedAt = new Date(startTime * 1000)
  if (!Number.isFinite(startedAt.getTime())) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
  const durationSeconds = optionalInteger(match.duration, 'invalid duration')
  const gameModeId = optionalInteger(match.game_mode, 'invalid game mode')
  const lobbyTypeId = optionalInteger(match.lobby_type, 'invalid lobby type')
  const humanPlayers = optionalInteger(match.human_players, 'invalid human player count')
  if (!Array.isArray(match.players)) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
  const players = match.players.map((player) => playerMatch(player, match, durationSeconds))
    .filter((player): player is ProviderPlayerMatch => player !== undefined)
  if (new Set(players.map((player) => player.accountId)).size !== players.length) {
    throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
  }
  return {
    id, startedAt,
    ...(durationSeconds !== undefined && { durationSeconds }),
    gameMode: normalizeMode(gameModeId, lobbyTypeId, humanPlayers),
    players,
    source: {
      provider: 'OPENDOTA',
      ...(gameModeId !== undefined && { gameModeId }),
      ...(lobbyTypeId !== undefined && { lobbyTypeId }),
      rawPayload: raw,
    },
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

export class OpenDotaMatchProvider implements MatchProvider {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly apiRoot: string

  constructor(private readonly options: OpenDotaProviderOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 10000
    this.apiRoot = (options.apiRoot ?? API_ROOT).replace(/\/$/, '')
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 60000) {
      throw new RangeError('OpenDota timeout must be between 100 and 60000 ms')
    }
  }

  async getPlayerMatches(accountId: number, afterMatchId?: string): Promise<ProviderMatchSummary[]> {
    if (!Number.isSafeInteger(accountId) || accountId <= 0 || accountId > 0xffffffff) {
      throw new RangeError('Invalid player account ID')
    }
    const after = afterMatchId === undefined ? undefined : BigInt(matchId(afterMatchId))
    const results: ProviderMatchSummary[] = []
    const maxPages = after === undefined ? 1 : MAX_INCREMENTAL_PAGES

    for (let page = 0; page < maxPages; page++) {
      const payload = await this.request(`/players/${accountId}/matches`, {
        limit: PAGE_SIZE, offset: page * PAGE_SIZE, significant: 0, sort: 'match_id',
      })
      if (!Array.isArray(payload) || payload.length > PAGE_SIZE) {
        throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
      }
      let reachedCursor = false
      let priorId: bigint | undefined
      for (const entry of payload) {
        const row = record(entry, 'invalid player match')
        const id = matchId(row.match_id)
        const numericId = BigInt(id)
        if (priorId !== undefined && numericId >= priorId) {
          throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
        }
        priorId = numericId
        const startTime = optionalInteger(row.start_time, 'invalid match start time')
        if (!startTime) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
        if (after !== undefined && numericId <= after) {
          reachedCursor = true
          continue
        }
        results.push({ id, startedAt: new Date(startTime * 1000) })
      }
      if (reachedCursor || payload.length < PAGE_SIZE || after === undefined) return results
    }
    throw new OpenDotaProviderError('PAGINATION_LIMIT', true)
  }

  async getMatch(id: string): Promise<ProviderMatch> {
    const normalizedId = matchId(id)
    const match = normalizeOpenDotaMatch(await this.request(`/matches/${normalizedId}`))
    if (match.id !== normalizedId) throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
    return match
  }

  private async request(path: string, params?: Record<string, string | number>): Promise<unknown> {
    const url = new URL(`${this.apiRoot}${path}`)
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value))
    const apiKey = this.options.apiKey?.trim()
    if (apiKey) url.searchParams.set('api_key', apiKey)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      let response: Response
      try {
        response = await this.fetchImpl(url, {
          headers: { accept: 'application/json', 'user-agent': 'AegisTrials/1.0' },
          signal: controller.signal,
        })
      } catch (error) {
        const timedOut = controller.signal.aborted || (error instanceof Error
          && (error.name === 'AbortError' || error.name === 'TimeoutError'))
        throw new OpenDotaProviderError(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', true)
      }
      if (response.status === 429) {
        throw new OpenDotaProviderError('RATE_LIMITED', true, parseRetryAfter(response.headers.get('retry-after')), 429)
      }
      if (response.status === 404) throw new OpenDotaProviderError('NOT_FOUND', false, undefined, 404)
      if (!response.ok) throw new OpenDotaProviderError('HTTP_ERROR', response.status >= 500, undefined, response.status)
      try {
        return await response.json() as unknown
      } catch {
        if (controller.signal.aborted) throw new OpenDotaProviderError('TIMEOUT', true)
        throw new OpenDotaProviderError('MALFORMED_RESPONSE', false)
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
