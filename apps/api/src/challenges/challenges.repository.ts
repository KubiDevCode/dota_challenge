import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { Prisma } from '../database/generated/client'
import type { ListChallengesQueryDto } from './challenges.dto'

export const challengeInclude = { rules: true } as const
export const userChallengeInclude = {
  challenge: { include: challengeInclude },
  completedByMatch: { select: { id: true, startedAt: true, duration: true, matchMode: true } },
} as const

@Injectable()
export class ChallengesRepository {
  constructor(readonly db: PrismaService) {}

  listAvailable(query: ListChallengesQueryDto, now: Date) {
    const where: Prisma.ChallengeWhereInput = {
      publicationStatus: 'PUBLISHED',
      OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
      AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gt: now } }] }],
      difficulty: query.difficulty,
      mode: query.mode,
      period: query.period,
      category: query.category,
    }
    const daily = query.period === 'DAILY'
    return this.db.challenge.findMany({
      where, include: challengeInclude, orderBy: [{ availableFrom: 'desc' }, { id: 'asc' }],
      skip: daily ? 0 : (query.page - 1) * query.limit, take: daily ? 3 : query.limit,
    })
  }

  findUserChallenges(userId: string) {
    return this.db.userChallenge.findMany({
      where: { userId }, include: userChallengeInclude,
      orderBy: [{ activatedAt: 'desc' }, { id: 'asc' }],
    })
  }
}
