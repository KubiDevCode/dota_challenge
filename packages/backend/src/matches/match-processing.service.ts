import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { evaluateChallengeRules } from '@aegis-trials/shared'
import type { ChallengeRule as SharedRule, NormalizedPlayerMatch } from '@aegis-trials/shared'
import { Prisma, PrismaClient } from '../generated/client'
import type { ChallengeRule } from '../generated/client'
import { MATCH_PROVIDER } from '../integrations/match-provider'
import type { MatchProvider, ProviderMatch, ProviderPlayerMatch } from '../integrations/match-provider'

function toRule(rule: ChallengeRule): SharedRule {
  return {
    metric: rule.metric,
    operator: rule.operator,
    value: rule.metric === 'win' ? rule.booleanValue : rule.numberValue,
  } as SharedRule
}

function metricValues(stats: {
  win: boolean | null; kills: number | null; deaths: number | null; assists: number | null
  killParticipation: number | null; lastHits: number | null; heroDamage: number | null
  towerDamage: number | null; wardsPlaced: number | null; heroId: number | null
}, duration: number | null): NormalizedPlayerMatch {
  return { ...stats, duration }
}

function statsData(player: ProviderPlayerMatch) {
  return {
    win: player.win ?? null,
    kills: player.kills ?? null,
    deaths: player.deaths ?? null,
    assists: player.assists ?? null,
    killParticipation: player.killParticipation ?? null,
    lastHits: player.lastHits ?? null,
    heroDamage: player.heroDamage ?? null,
    towerDamage: player.towerDamage ?? null,
    wardsPlaced: player.wardsPlaced ?? null,
    heroId: player.heroId ?? null,
    itemIds: player.itemIds ? [...player.itemIds] : [],
  }
}

function statsUpdate(player: ProviderPlayerMatch) {
  return Object.fromEntries(Object.entries(statsData(player)).filter(([, value]) => value !== null))
}

function matchModeAllowed(match: ProviderMatch, allowed: readonly number[]): boolean {
  if (match.gameMode === 'UNSUPPORTED') return false
  const mode = match.source.gameModeId
  return mode !== undefined && (allowed.length === 0 || allowed.includes(mode))
}

/** Callable by a future worker or a manual refresh service. No scheduling or HTTP boundary here. */
@Injectable()
export class MatchProcessingService {
  constructor(
    private readonly db: PrismaClient,
    @Inject(MATCH_PROVIDER) private readonly provider: MatchProvider,
  ) {}

  async processMatch(userId: string, matchId: string): Promise<void> {
    await this.processProviderMatch(userId, await this.provider.getMatch(matchId))
  }

  /** History is processed oldest first so the first eligible SINGLE_MATCH is claimed first. */
  async processPlayerMatches(userId: string, afterMatchId?: string): Promise<{ matchCount: number; lastMatchId?: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { accountId32: true } })
    if (!user) throw new NotFoundException('User not found')
    const accountId = Number(user.accountId32)
    const history = await this.provider.getPlayerMatches(accountId, afterMatchId)
    for (const item of [...history].sort((a, b) => {
      const byTime = a.startedAt.getTime() - b.startedAt.getTime()
      return byTime || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)
    })) {
      await this.processProviderMatch(userId, await this.provider.getMatch(item.id))
    }
    // Revisit incomplete evaluations when a provider fills missing metrics later.
    const pending = await this.db.challengeEvaluation.findMany({
      where: { userChallenge: { userId, status: 'ACTIVE' }, status: 'PENDING' },
      select: { matchId: true }, distinct: ['matchId'],
    })
    for (const { matchId } of pending) {
      if (!history.some((item) => item.id === matchId)) await this.processMatch(userId, matchId)
    }
    return { matchCount: history.length, lastMatchId: history[0]?.id ?? afterMatchId }
  }

  private async processProviderMatch(userId: string, match: ProviderMatch): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // The same user lock serializes manual refresh, sync and retries across processes.
      // It also covers rewards for different matches that finish simultaneously.
      const locked = await tx.$queryRaw<{ accountId32: bigint }[]>`
        SELECT "accountId32" FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`
      if (locked.length === 0) throw new NotFoundException('User not found')
      const player = match.players.find((entry) => BigInt(entry.accountId) === locked[0].accountId32)
      if (!player) throw new Error('Provider match does not belong to the user')
      if (match.source.provider !== 'OPENDOTA') throw new Error('Unsupported match provider')

      const persistedMatch = await tx.match.upsert({
        where: { id: match.id },
        create: {
          id: match.id, provider: 'OPENDOTA', startedAt: match.startedAt,
          duration: match.durationSeconds ?? null, matchMode: match.source.gameModeId ?? null,
          lobbyType: match.source.lobbyTypeId ?? null,
          rawPayload: match.source.rawPayload as Prisma.InputJsonValue,
        },
        update: {
          provider: 'OPENDOTA',
          ...(match.durationSeconds !== undefined && { duration: match.durationSeconds }),
          ...(match.source.gameModeId !== undefined && { matchMode: match.source.gameModeId }),
          ...(match.source.lobbyTypeId !== undefined && { lobbyType: match.source.lobbyTypeId }),
          rawPayload: match.source.rawPayload as Prisma.InputJsonValue,
        },
      })
      if (persistedMatch.startedAt.getTime() !== match.startedAt.getTime()) {
        throw new Error('Provider match start time changed')
      }
      const stats = await tx.playerMatchStats.upsert({
        where: { matchId_userId: { matchId: match.id, userId } },
        create: { matchId: match.id, userId, ...statsData(player) },
        update: statsUpdate(player),
      })
      const enrollments = await tx.userChallenge.findMany({
        where: { userId, status: 'ACTIVE', activatedAt: { lt: match.startedAt }, AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: match.startedAt } }] },
          { challenge: { OR: [{ availableUntil: null }, { availableUntil: { gt: match.startedAt } }] } },
        ] },
        include: { challenge: { include: { rules: true } } },
        orderBy: { activatedAt: 'asc' },
      })
      for (const enrollment of enrollments) {
        if (!matchModeAllowed(match, enrollment.challenge.allowedMatchModes)) continue
        const previous = await tx.challengeEvaluation.findUnique({
          where: { userChallengeId_matchId: { userChallengeId: enrollment.id, matchId: match.id } },
        })
        if (previous && previous.status !== 'PENDING') continue
        if (enrollment.challenge.mode === 'SINGLE_MATCH') {
          const claimed = await tx.challengeEvaluation.findFirst({
            where: { userChallengeId: enrollment.id }, select: { matchId: true },
            orderBy: [{ match: { startedAt: 'asc' } }, { matchId: 'asc' }],
          })
          if (claimed && claimed.matchId !== match.id) continue
        }

        const result = evaluateChallengeRules(
          enrollment.challenge.rules.map(toRule), metricValues(stats, persistedMatch.duration),
        )
        const buildReady = enrollment.challenge.requiredHeroId === null
          || stats.heroId === enrollment.challenge.requiredHeroId
        const requiredItems = enrollment.challenge.requiredItemIds
        const missingItems = requiredItems.length > 0 && !requiredItems.every((itemId) => stats.itemIds.includes(itemId))
        const finalStatus = result.status === 'PASS' && (!buildReady || missingItems) ? 'FAIL' : result.status
        const details = JSON.parse(JSON.stringify({ ...result,
          ...(enrollment.challenge.requiredHeroId !== null && { requiredHeroId: enrollment.challenge.requiredHeroId, actualHeroId: stats.heroId }),
          ...(requiredItems.length > 0 && { requiredItemIds: requiredItems, actualItemIds: stats.itemIds }),
          ...(finalStatus !== result.status && { status: finalStatus, reason: 'BUILD_REQUIREMENTS_FAILED' }),
        })) as Prisma.InputJsonValue
        await tx.challengeEvaluation.upsert({
          where: { userChallengeId_matchId: { userChallengeId: enrollment.id, matchId: match.id } },
          create: { userChallengeId: enrollment.id, matchId: match.id,
            status: finalStatus, explanation: finalStatus === result.status ? result.reason : 'BUILD_REQUIREMENTS_FAILED', details },
          update: { status: finalStatus, explanation: finalStatus === result.status ? result.reason : 'BUILD_REQUIREMENTS_FAILED', details },
        })
        if (finalStatus === 'PENDING') continue

        const nextStatus = finalStatus === 'PASS' ? 'SUCCEEDED'
          : enrollment.challenge.mode === 'SINGLE_MATCH' ? 'FAILED' : 'ACTIVE'
        const transition = await tx.userChallenge.updateMany({
          where: { id: enrollment.id, status: 'ACTIVE' },
          data: {
            status: nextStatus, attemptsChecked: { increment: 1 },
            ...(finalStatus === 'PASS' && { completedAt: new Date(), completedByMatchId: match.id }),
          },
        })
        if (transition.count !== 1) throw new Error('Challenge changed while processing')
        if (finalStatus !== 'PASS') continue

        // A delayed match can belong to a season that has since ended. A draft
        // season never earns points. A match outside all seasons earns XP only.
        const season = await tx.season.findFirst({
          where: { status: { in: ['ACTIVE', 'ENDED'] },
            startsAt: { lte: match.startedAt }, endsAt: { gt: match.startedAt } },
          orderBy: { startsAt: 'desc' }, select: { id: true },
        })
        const points = season ? enrollment.challenge.seasonPointsReward : 0
        if (season) {
          await tx.seasonScore.upsert({
            where: { userId_seasonId: { userId, seasonId: season.id } },
            create: { userId, seasonId: season.id, points: 0 }, update: {},
          })
        }
        // The primary key is the grant identity. Any duplicate insert aborts the
        // whole transaction, including status and counters.
        await tx.rewardLedger.create({ data: {
          userChallengeId: enrollment.id, userId, seasonId: season?.id ?? null,
          xp: enrollment.challenge.xpReward, seasonPoints: points,
        } })
        await tx.user.update({ where: { id: userId },
          data: { totalXp: { increment: enrollment.challenge.xpReward } } })
        if (season) {
          await tx.seasonScore.update({
            where: { userId_seasonId: { userId, seasonId: season.id } },
            data: { points: { increment: points } },
          })
        }
      }
    })
  }
}
