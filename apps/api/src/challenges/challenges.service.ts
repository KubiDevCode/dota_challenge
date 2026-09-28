import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { ChallengeRule as SharedRule } from '@aegis-trials/shared'
import { Prisma } from '../database/generated/client'
import type { Challenge, ChallengeRule, UserChallenge } from '../database/generated/client'
import { ChallengesRepository } from './challenges.repository'
import type { ListChallengesQueryDto } from './challenges.dto'

type ChallengeWithRules = Challenge & { rules: ChallengeRule[] }
type EnrollmentWithChallenge = UserChallenge & {
  challenge: ChallengeWithRules
  completedByMatch?: { id: string; startedAt: Date; duration: number | null; matchMode: number | null } | null
}

function publicChallenge(challenge: ChallengeWithRules) {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    difficulty: challenge.difficulty,
    mode: challenge.mode,
    xpReward: challenge.xpReward,
    seasonPointsReward: challenge.seasonPointsReward,
    allowedMatchModes: challenge.allowedMatchModes,
    rules: challenge.rules.map((rule): SharedRule => ({
      metric: rule.metric, operator: rule.operator,
      value: rule.metric === 'win' ? rule.booleanValue! : rule.numberValue!,
    }) as SharedRule),
  }
}

function publicEnrollment(enrollment: EnrollmentWithChallenge) {
  return {
    id: enrollment.id,
    challenge: publicChallenge(enrollment.challenge),
    status: enrollment.status,
    activatedAt: enrollment.activatedAt,
    attemptsChecked: enrollment.attemptsChecked,
    completedAt: enrollment.completedAt,
    completedByMatchId: enrollment.completedByMatchId,
    completedByMatch: enrollment.completedByMatch ?? null,
  }
}

@Injectable()
export class ChallengesService {
  constructor(private readonly repository: ChallengesRepository) {}

  async list(query: ListChallengesQueryDto) {
    const rows = await this.repository.listAvailable(query, new Date())
    return { items: rows.map(publicChallenge), page: query.page, limit: query.limit }
  }

  async listMine(userId: string) {
    return (await this.repository.findUserChallenges(userId)).map(publicEnrollment)
  }

  async activate(userId: string, challengeId: string) {
    const db = this.repository.db
    try {
      return await db.$transaction(async (tx) => {
        // Serialize every activation for this user across API instances. The lock is held
        // until commit, so the next request counts the row created by the previous one.
        const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`
        if (locked.length === 0) throw new NotFoundException('User not found')

        const challenge = await tx.challenge.findUnique({ where: { id: challengeId }, include: { rules: true } })
        if (!challenge) throw new NotFoundException('Challenge not found')
        if (challenge.publicationStatus !== 'PUBLISHED' || (challenge.availableFrom && challenge.availableFrom > new Date())) {
          throw new ConflictException('Challenge is not available')
        }
        const existing = await tx.userChallenge.findUnique({ where: { userId_challengeId: { userId, challengeId } } })
        if (existing) throw new ConflictException('Challenge already activated')
        const active = await tx.userChallenge.count({ where: { userId, status: 'ACTIVE' } })
        if (active >= 3) throw new ConflictException('Maximum of three active challenges')
        const enrollment = await tx.userChallenge.create({
          data: { userId, challengeId, status: 'ACTIVE', activatedAt: new Date() },
        })
        return publicEnrollment({ ...enrollment, challenge })
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Challenge already activated')
      }
      throw error
    }
  }

  async cancel(userId: string, userChallengeId: string) {
    const db = this.repository.db
    return db.$transaction(async (tx) => {
      const enrollment = await tx.userChallenge.findFirst({
        where: { id: userChallengeId, userId }, include: { challenge: { include: { rules: true } } },
      })
      if (!enrollment) throw new NotFoundException('User challenge not found')
      if (enrollment.status !== 'ACTIVE') throw new ConflictException('Only active challenges can be cancelled')
      const result = await tx.userChallenge.updateMany({
        where: { id: userChallengeId, userId, status: 'ACTIVE' }, data: { status: 'CANCELLED' },
      })
      if (result.count !== 1) throw new ConflictException('Challenge is no longer active')
      return publicEnrollment({ ...enrollment, status: 'CANCELLED' })
    })
  }
}
