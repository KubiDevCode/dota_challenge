import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { levelForXp } from '../matches/level'
import type { PageQueryDto } from '../pagination.dto'

@Injectable()
export class RankingsService {
  constructor(private readonly db: PrismaService) {}

  private async activeSeason() {
    // The database also has a partial unique index. Detect broken data rather than
    // letting findFirst silently pick an arbitrary active season.
    const seasons = await this.db.season.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, startsAt: true, endsAt: true }, take: 2,
    })
    if (seasons.length > 1) throw new InternalServerErrorException('Multiple active seasons')
    return seasons[0] ?? null
  }

  async currentSeason() {
    const season = await this.activeSeason()
    if (!season) throw new NotFoundException('No active season')
    return season
  }

  async leaderboard(query: PageQueryDto) {
    const season = await this.currentSeason()
    const [scores, thresholds] = await Promise.all([
      this.db.seasonScore.findMany({
        where: { seasonId: season.id },
        // Stable tie break: earlier score row first, then user UUID ascending.
        orderBy: [{ points: 'desc' }, { createdAt: 'asc' }, { userId: 'asc' }],
        skip: (query.page - 1) * query.limit, take: query.limit + 1,
        select: { userId: true, points: true, user: { select: {
          displayName: true, avatarUrl: true, totalXp: true,
        } } },
      }),
      this.db.levelThreshold.findMany({ select: {
        level: true, requiredTotalXp: true, rankName: true,
      } }),
    ])
    return {
      season,
      items: scores.slice(0, query.limit).map((score, index) => ({
        userId: score.userId,
        displayName: score.user.displayName,
        avatarUrl: score.user.avatarUrl,
        totalXp: score.user.totalXp,
        level: levelForXp(score.user.totalXp, thresholds),
        seasonalScore: score.points,
        position: (query.page - 1) * query.limit + index + 1,
      })),
      page: query.page, limit: query.limit, hasMore: scores.length > query.limit,
    }
  }

  async publicProfile(userId: string) {
    const [user, season, thresholds] = await Promise.all([
      this.db.user.findUnique({ where: { id: userId }, select: {
        id: true, displayName: true, avatarUrl: true, totalXp: true,
        _count: { select: { challenges: { where: { status: 'SUCCEEDED' } } } },
      } }),
      this.activeSeason(),
      this.db.levelThreshold.findMany({ select: {
        level: true, requiredTotalXp: true, rankName: true,
      } }),
    ])
    if (!user) throw new NotFoundException('User not found')
    const score = season ? await this.db.seasonScore.findUnique({
      where: { userId_seasonId: { userId, seasonId: season.id } }, select: { points: true },
    }) : null
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      totalXp: user.totalXp,
      level: levelForXp(user.totalXp, thresholds),
      seasonalScore: score?.points ?? 0,
      seasonId: season?.id ?? null,
      completedChallenges: user._count.challenges,
    }
  }
}
