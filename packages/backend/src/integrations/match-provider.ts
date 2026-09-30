import type { NormalizedPlayerMatch } from '@aegis-trials/shared'

/** Provider-neutral classification. Unknown or unsupported modes are never eligible. */
export type ProviderGameMode = 'RANKED' | 'ALL_PICK' | 'UNSUPPORTED'

export interface ProviderPlayerMatch extends NormalizedPlayerMatch {
  readonly accountId: number
  /** Kills by this player's team, when available for participation calculations. */
  readonly teamKills?: number
}

export interface ProviderMatch {
  readonly id: string
  readonly startedAt: Date
  /** Seconds. Missing duration remains unavailable to the rule engine. */
  readonly durationSeconds?: number
  readonly gameMode: ProviderGameMode
  readonly players: readonly ProviderPlayerMatch[]
  /** Provider values and payload are kept separate from normalized match data. */
  readonly source: Readonly<{
    provider: string
    gameModeId?: number
    lobbyTypeId?: number
    rawPayload: unknown
  }>
}

export interface ProviderMatchSummary {
  readonly id: string
  readonly startedAt: Date
}

export interface MatchProvider {
  /** Newest match ID first. With a cursor, returns only IDs greater than it. */
  getPlayerMatches(accountId: number, afterMatchId?: string): Promise<ProviderMatchSummary[]>
  getMatch(matchId: string): Promise<ProviderMatch>
}

export const MATCH_PROVIDER = Symbol('MATCH_PROVIDER')
