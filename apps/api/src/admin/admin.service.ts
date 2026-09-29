import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { assertChallengeRule } from '@aegis-trials/shared'
import type { ChallengeRule as SharedRule } from '@aegis-trials/shared'
import { Prisma } from '../database/generated/client'
import type { Challenge, ChallengeRule } from '../database/generated/client'
import { PrismaService } from '../database/prisma.service'
import type { AdminRuleDto, CreateChallengeDto, CreateSeasonDto, PatchChallengeDto, PatchSeasonDto, ReplaceLevelThresholdsDto } from './admin.dto'

type ChallengeWithRules = Challenge & { rules: ChallengeRule[] }

function ruleData(rule: AdminRuleDto) {
  if (Object.keys(rule).some((key) => !['metric', 'operator', 'value'].includes(key))) {
    throw new BadRequestException('Rule contains an unknown field')
  }
  const candidate: unknown = { metric: rule.metric, operator: rule.operator, value: rule.value }
  try { assertChallengeRule(candidate) }
  catch { throw new BadRequestException('Invalid rule metric, operator or value') }
  return {
    metric: candidate.metric,
    operator: candidate.operator,
    numberValue: candidate.metric === 'win' ? null : candidate.value,
    booleanValue: candidate.metric === 'win' ? candidate.value : null,
  }
}

function challengeResponse(challenge: ChallengeWithRules) {
  return {
    id: challenge.id, title: challenge.title, description: challenge.description,
    category: challenge.category, difficulty: challenge.difficulty, mode: challenge.mode,
    xpReward: challenge.xpReward, seasonPointsReward: challenge.seasonPointsReward,
    allowedMatchModes: challenge.allowedMatchModes, publicationStatus: challenge.publicationStatus,
    availableFrom: challenge.availableFrom, createdAt: challenge.createdAt, updatedAt: challenge.updatedAt,
    rules: challenge.rules.map((rule): SharedRule => ({
      metric: rule.metric, operator: rule.operator,
      value: rule.metric === 'win' ? rule.booleanValue! : rule.numberValue!,
    }) as SharedRule),
  }
}

function dateOrNull(value: string | null | undefined): Date | null | undefined {
  if (value === null || value === undefined) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date')
  return date
}

function seasonDates(startsAt: Date, endsAt: Date): void {
  if (startsAt >= endsAt) throw new BadRequestException('startsAt must be before endsAt')
}

function nonemptyPatch(body: object): void {
  if (Object.keys(body).length === 0) throw new BadRequestException('Patch body must contain a field')
}

function activeSeasonConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('An ACTIVE season already exists')
  }
  throw error
}

@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}

  async listChallenges() {
    const rows = await this.db.challenge.findMany({ include: { rules: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
    return rows.map(challengeResponse)
  }

  async createChallenge(body: CreateChallengeDto) {
    const rules = body.rules.map(ruleData)
    const challenge = await this.db.challenge.create({
      data: {
        title: body.title.trim(), description: body.description, category: body.category.trim(),
        difficulty: body.difficulty, mode: body.mode, xpReward: body.xpReward,
        seasonPointsReward: body.seasonPointsReward ?? 0,
        allowedMatchModes: body.allowedMatchModes ?? [],
        publicationStatus: body.publicationStatus ?? 'DRAFT',
        availableFrom: dateOrNull(body.availableFrom) ?? null,
        rules: { create: rules },
      },
      include: { rules: true },
    })
    return challengeResponse(challenge)
  }

  async patchChallenge(id: string, body: PatchChallengeDto) {
    nonemptyPatch(body)
    const rules = body.rules?.map(ruleData)
    return this.db.$transaction(async (tx) => {
      const current = await tx.challenge.findUnique({ where: { id }, select: { id: true } })
      if (!current) throw new NotFoundException('Challenge not found')
      const challenge = await tx.challenge.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title.trim() }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.category !== undefined && { category: body.category.trim() }),
          ...(body.difficulty !== undefined && { difficulty: body.difficulty }),
          ...(body.mode !== undefined && { mode: body.mode }),
          ...(body.xpReward !== undefined && { xpReward: body.xpReward }),
          ...(body.seasonPointsReward !== undefined && { seasonPointsReward: body.seasonPointsReward }),
          ...(body.allowedMatchModes !== undefined && { allowedMatchModes: body.allowedMatchModes }),
          ...(body.publicationStatus !== undefined && { publicationStatus: body.publicationStatus }),
          ...(body.availableFrom !== undefined && { availableFrom: dateOrNull(body.availableFrom) }),
          ...(rules !== undefined && { rules: { deleteMany: {}, create: rules } }),
        },
        include: { rules: true },
      })
      return challengeResponse(challenge)
    })
  }

  listLevelThresholds() {
    return this.db.levelThreshold.findMany({ orderBy: { level: 'asc' } })
  }

  async replaceLevelThresholds(body: ReplaceLevelThresholdsDto) {
    const thresholds = [...body.thresholds].sort((a, b) => a.level - b.level)
    if (thresholds[0]?.level !== 1 || thresholds[0].requiredTotalXp !== 0) {
      throw new BadRequestException('Level 1 must start at 0 XP')
    }
    for (let i = 1; i < thresholds.length; i += 1) {
      if (thresholds[i].level !== thresholds[i - 1].level + 1
        || thresholds[i].requiredTotalXp <= thresholds[i - 1].requiredTotalXp) {
        throw new BadRequestException('Levels must be unique and consecutive, with strictly increasing XP')
      }
    }
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE "LevelThreshold" IN EXCLUSIVE MODE`
      await tx.levelThreshold.deleteMany()
      await tx.levelThreshold.createMany({ data: thresholds.map((row) => ({
        level: row.level, requiredTotalXp: row.requiredTotalXp, rankName: row.rankName.trim(),
      })) })
      return tx.levelThreshold.findMany({ orderBy: { level: 'asc' } })
    })
  }

  listSeasons() {
    return this.db.season.findMany({ orderBy: [{ startsAt: 'desc' }, { id: 'asc' }] })
  }

  async createSeason(body: CreateSeasonDto) {
    const startsAt = dateOrNull(body.startsAt)!
    const endsAt = dateOrNull(body.endsAt)!
    seasonDates(startsAt, endsAt)
    try {
      return await this.db.season.create({ data: {
        name: body.name.trim(), startsAt, endsAt, status: body.status ?? 'DRAFT',
      } })
    } catch (error) { activeSeasonConflict(error) }
  }

  async patchSeason(id: string, body: PatchSeasonDto) {
    nonemptyPatch(body)
    try {
      return await this.db.$transaction(async (tx) => {
        const current = await tx.season.findUnique({ where: { id } })
        if (!current) throw new NotFoundException('Season not found')
        const startsAt = dateOrNull(body.startsAt) ?? current.startsAt
        const endsAt = dateOrNull(body.endsAt) ?? current.endsAt
        seasonDates(startsAt, endsAt)
        return tx.season.update({ where: { id }, data: {
          ...(body.name !== undefined && { name: body.name.trim() }),
          ...(body.startsAt !== undefined && { startsAt }),
          ...(body.endsAt !== undefined && { endsAt }),
          ...(body.status !== undefined && { status: body.status }),
        } })
      })
    } catch (error) { activeSeasonConflict(error) }
  }
}
