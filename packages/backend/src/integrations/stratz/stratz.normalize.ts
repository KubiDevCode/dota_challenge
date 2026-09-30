import type { ProviderGameMode, ProviderMatch, ProviderPlayerMatch } from '../match-provider'

type JsonRecord = Record<string, unknown>

export class StratzMalformedResponseError extends Error {
  constructor(detail: string) {
    super(`STRATZ returned malformed data: ${detail}`)
    this.name = 'StratzMalformedResponseError'
  }
}

export function record(value: unknown, detail: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new StratzMalformedResponseError(detail)
  }
  return value as JsonRecord
}

export function matchId(value: unknown): string {
  if (typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value)) return value
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  throw new StratzMalformedResponseError('invalid match ID')
}

export function numericMatchId(value: string): number {
  const id = matchId(value)
  const numeric = Number(id)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new RangeError('Match ID exceeds JavaScript safe integer range')
  }
  return numeric
}

function optionalNumber(value: unknown, detail: string): number | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new StratzMalformedResponseError(detail)
  }
  return value
}

function normalizeGameModeId(value: unknown): number | undefined {
  if (typeof value === 'string') {
    if (value === 'ALL_PICK') return 1
    if (value === 'ALL_PICK_RANKED') return 22
    return undefined
  }
  return optionalNumber(value, 'invalid game mode')
}

function normalizeLobbyTypeId(value: unknown): number | undefined {
  if (typeof value === 'string') {
    if (value === 'UNRANKED') return 0
    if (value === 'RANKED') return 7
    return undefined
  }
  return optionalNumber(value, 'invalid lobby type')
}

function optionalBoolean(value: unknown, detail: string): boolean | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'boolean') throw new StratzMalformedResponseError(detail)
  return value
}

/** Only public All Pick and ranked matchmaking are eligible. Unknown IDs fail closed. */
export function normalizeGameMode(
  gameModeId: number | undefined,
  lobbyTypeId: number | undefined,
  numHumanPlayers: number | undefined,
): ProviderGameMode {
  // A full human lobby must be confirmed; missing count cannot prove bots absent.
  if (numHumanPlayers !== 10) return 'UNSUPPORTED'
  if (lobbyTypeId === 7 && (gameModeId === 22 || gameModeId === 1)) return 'RANKED'
  if (lobbyTypeId === 0 && gameModeId === 1) return 'ALL_PICK'
  return 'UNSUPPORTED'
}

function normalizePlayer(raw: unknown, match: JsonRecord, durationSeconds: number | undefined): ProviderPlayerMatch | undefined {
  const player = record(raw, 'invalid player')
  const accountId = optionalNumber(player.steamAccountId, 'invalid player account ID')
  // STRATZ can include anonymous players. They have no stable account ID to persist.
  if (accountId === undefined || accountId === 0) return undefined
  if (accountId > 0xffffffff) throw new StratzMalformedResponseError('invalid player account ID')

  const isRadiant = optionalBoolean(player.isRadiant, 'invalid player side')
  const isVictory = optionalBoolean(player.isVictory, 'invalid victory flag')
  const didRadiantWin = optionalBoolean(match.didRadiantWin, 'invalid match victory flag')
  const win = isVictory ?? (isRadiant !== undefined && didRadiantWin !== undefined
    ? isRadiant === didRadiantWin : undefined)
  const teamKills = isRadiant === undefined ? undefined : optionalNumber(
    isRadiant ? match.radiantKills : match.direKills, 'invalid team kill count',
  )
  const kills = optionalNumber(player.kills, 'invalid kills')
  const deaths = optionalNumber(player.deaths, 'invalid deaths')
  const assists = optionalNumber(player.assists, 'invalid assists')
  const lastHits = optionalNumber(player.numLastHits, 'invalid last hits')
  const heroDamage = optionalNumber(player.heroDamage, 'invalid hero damage')
  const towerDamage = optionalNumber(player.towerDamage, 'invalid tower damage')
  const heroId = optionalNumber(player.heroId, 'invalid hero ID')
  let killParticipation: number | undefined
  if (kills !== undefined && assists !== undefined && teamKills !== undefined) {
    if (teamKills === 0 && kills + assists === 0) killParticipation = 0
    else if (teamKills > 0 && kills + assists <= teamKills) {
      killParticipation = (kills + assists) / teamKills
    }
  }

  let wardsPlaced: number | undefined
  if (player.stats !== null && player.stats !== undefined) {
    const stats = record(player.stats, 'invalid player stats')
    if (stats.wards !== null && stats.wards !== undefined) {
      if (!Array.isArray(stats.wards) || stats.wards.some((ward) =>
        typeof ward !== 'object' || ward === null || Array.isArray(ward))) {
        throw new StratzMalformedResponseError('invalid ward events')
      }
      wardsPlaced = stats.wards.length
    }
  }

  return {
    accountId,
    ...(durationSeconds !== undefined && { duration: durationSeconds }),
    ...(win !== undefined && { win }),
    ...(teamKills !== undefined && { teamKills }),
    ...(killParticipation !== undefined && { killParticipation }),
    ...(wardsPlaced !== undefined && { wardsPlaced }),
    ...(kills !== undefined && { kills }),
    ...(assists !== undefined && { assists }),
    ...(deaths !== undefined && { deaths }),
    ...(lastHits !== undefined && { lastHits }),
    ...(heroDamage !== undefined && { heroDamage }),
    ...(towerDamage !== undefined && { towerDamage }),
    ...(heroId !== undefined && heroId > 0 && { heroId }),
  }
}

export function normalizeStratzMatch(raw: unknown): ProviderMatch {
  const match = record(raw, 'invalid match')
  const id = matchId(match.id)
  const startedAtSeconds = optionalNumber(match.startDateTime, 'invalid start time')
  if (startedAtSeconds === undefined || startedAtSeconds === 0) {
    throw new StratzMalformedResponseError('missing start time')
  }
  const startedAt = new Date(startedAtSeconds * 1000)
  if (Number.isNaN(startedAt.getTime())) throw new StratzMalformedResponseError('invalid start time')
  const durationSeconds = optionalNumber(match.durationSeconds, 'invalid duration')
  const gameModeId = normalizeGameModeId(match.gameMode)
  const lobbyTypeId = normalizeLobbyTypeId(match.lobbyType)
  const numHumanPlayers = optionalNumber(match.numHumanPlayers, 'invalid human player count')
  if (!Array.isArray(match.players)) throw new StratzMalformedResponseError('missing players')
  const players = match.players.map((player) => normalizePlayer(player, match, durationSeconds))
    .filter((player): player is ProviderPlayerMatch => player !== undefined)
  if (new Set(players.map((player) => player.accountId)).size !== players.length) {
    throw new StratzMalformedResponseError('duplicate player account ID')
  }

  return {
    id,
    startedAt,
    ...(durationSeconds !== undefined && { durationSeconds }),
    gameMode: normalizeGameMode(gameModeId, lobbyTypeId, numHumanPlayers),
    players,
    source: {
      provider: 'STRATZ',
      ...(gameModeId !== undefined && { gameModeId }),
      ...(lobbyTypeId !== undefined && { lobbyTypeId }),
      rawPayload: raw,
    },
  }
}
