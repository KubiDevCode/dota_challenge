import type { MatchProvider, ProviderMatch } from '../match-provider'
import { matchId, normalizeStratzMatch, numericMatchId, record, StratzMalformedResponseError } from './stratz.normalize'
import { MATCH_QUERY, PLAYER_MATCHES_QUERY } from './stratz.queries'

const ENDPOINT = 'https://api.stratz.com/graphql'
const PAGE_SIZE = 50
const MAX_INCREMENTAL_PAGES = 10

export type StratzErrorCode =
  | 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK_ERROR' | 'HTTP_ERROR'
  | 'RATE_LIMITED' | 'GRAPHQL_ERROR' | 'NOT_FOUND' | 'PAGINATION_LIMIT'

export class StratzProviderError extends Error {
  constructor(
    readonly code: StratzErrorCode,
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
    readonly status?: number,
  ) {
    super(`STRATZ provider: ${code}`)
    this.name = 'StratzProviderError'
  }
}

export interface StratzProviderOptions {
  token?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
  endpoint?: string
}

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000)
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

function isRateLimitError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const error = value as Record<string, unknown>
  const extensions = error.extensions
  const code = typeof extensions === 'object' && extensions !== null && !Array.isArray(extensions)
    ? (extensions as Record<string, unknown>).code : undefined
  return (typeof code === 'string' && /RATE.?LIMIT|TOO.?MANY/i.test(code))
    || (typeof error.message === 'string' && /rate.?limit|too many requests/i.test(error.message))
}

/** Pure HTTP adapter; all external payload inspection stays within this directory. */
export class StratzMatchProvider implements MatchProvider {
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly endpoint: string

  constructor(private readonly options: StratzProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? 10000
    this.endpoint = options.endpoint ?? ENDPOINT
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 60000) {
      throw new RangeError('STRATZ timeout must be between 100 and 60000 ms')
    }
  }

  async getPlayerMatches(accountId: number, afterMatchId?: string): Promise<ProviderMatch[]> {
    if (!Number.isSafeInteger(accountId) || accountId <= 0 || accountId > 0xffffffff) {
      throw new RangeError('Invalid player account ID')
    }
    const after = afterMatchId === undefined ? undefined : BigInt(matchId(afterMatchId))
    const matches: ProviderMatch[] = []
    let before: number | undefined
    let lastId: bigint | undefined
    const maxPages = after === undefined ? 1 : MAX_INCREMENTAL_PAGES

    for (let page = 0; page < maxPages; page++) {
      const data = await this.execute(PLAYER_MATCHES_QUERY, {
        accountId,
        request: { take: PAGE_SIZE, orderBy: 'DESC', ...(before !== undefined && { before }) },
      })
      if (data.player === null) throw new StratzProviderError('NOT_FOUND', false)
      const player = record(data.player, 'missing player')
      if (!Array.isArray(player.matches)) throw new StratzMalformedResponseError('missing match list')
      if (player.matches.length > PAGE_SIZE) throw new StratzMalformedResponseError('oversized match page')
      let reachedCursor = false

      for (const raw of player.matches) {
        const id = BigInt(matchId(record(raw, 'invalid match').id))
        if (lastId !== undefined && id >= lastId) {
          throw new StratzMalformedResponseError('match page is not strictly descending')
        }
        lastId = id
        if (after !== undefined && id <= after) {
          reachedCursor = true
          break
        }
        const match = normalizeStratzMatch(raw)
        if (!match.players.some((entry) => entry.accountId === accountId)) {
          throw new StratzMalformedResponseError('requested player is absent from match')
        }
        matches.push(match)
      }

      if (reachedCursor || player.matches.length < PAGE_SIZE || after === undefined) return matches
      if (lastId === undefined) return matches
      before = numericMatchId(lastId.toString())
    }

    // A bounded scan must never claim an incomplete synchronization succeeded.
    throw new StratzProviderError('PAGINATION_LIMIT', true)
  }

  async getMatch(id: string): Promise<ProviderMatch> {
    const matchIdNumber = numericMatchId(id)
    const data = await this.execute(MATCH_QUERY, { matchId: matchIdNumber })
    if (data.match === null) throw new StratzProviderError('NOT_FOUND', false)
    const match = normalizeStratzMatch(data.match)
    if (match.id !== id) throw new StratzMalformedResponseError('unexpected match ID')
    return match
  }

  private async execute(query: string, variables: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = this.options.token?.trim()
    if (!token) throw new StratzProviderError('NOT_CONFIGURED', false)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      let response: Response
      try {
        response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        })
      } catch (error) {
        const timedOut = controller.signal.aborted || (error instanceof Error
          && (error.name === 'AbortError' || error.name === 'TimeoutError'))
        throw new StratzProviderError(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR', true)
      }

      if (response.status === 429) {
        throw new StratzProviderError('RATE_LIMITED', true, retryAfterMs(response.headers.get('retry-after')), 429)
      }
      if (!response.ok) {
        throw new StratzProviderError('HTTP_ERROR', response.status >= 500, undefined, response.status)
      }

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        if (controller.signal.aborted) throw new StratzProviderError('TIMEOUT', true)
        throw new StratzMalformedResponseError('invalid JSON')
      }
      const envelope = record(payload, 'invalid GraphQL envelope')
      if (envelope.errors !== undefined && envelope.errors !== null) {
        if (!Array.isArray(envelope.errors)) throw new StratzMalformedResponseError('invalid GraphQL errors')
        if (envelope.errors.length > 0) {
          const rateLimited = envelope.errors.some(isRateLimitError)
          throw new StratzProviderError(rateLimited ? 'RATE_LIMITED' : 'GRAPHQL_ERROR', rateLimited)
        }
      }
      return record(envelope.data, 'missing GraphQL data')
    } finally {
      clearTimeout(timer)
    }
  }
}
