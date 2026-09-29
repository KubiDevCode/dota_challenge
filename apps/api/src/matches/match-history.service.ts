import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import type { PageQueryDto } from '../pagination.dto'

@Injectable()
export class MatchHistoryService {
  constructor(private readonly db: PrismaService) {}

  async listMine(userId: string, query: PageQueryDto) {
    const rows = await this.db.playerMatchStats.findMany({
      where: { userId },
      orderBy: [{ match: { startedAt: 'desc' } }, { matchId: 'desc' }],
      skip: (query.page - 1) * query.limit, take: query.limit + 1,
      select: {
        matchId: true, win: true, kills: true, deaths: true, assists: true,
        killParticipation: true, lastHits: true, heroDamage: true,
        towerDamage: true, wardsPlaced: true, heroId: true,
        match: { select: { startedAt: true, duration: true, matchMode: true } },
      },
    })
    return {
      items: rows.slice(0, query.limit).map(({ match, ...stats }) => ({
        ...stats, startedAt: match.startedAt, duration: match.duration, matchMode: match.matchMode,
      })),
      page: query.page, limit: query.limit, hasMore: rows.length > query.limit,
    }
  }
}
