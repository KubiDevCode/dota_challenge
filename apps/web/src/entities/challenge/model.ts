import { z } from 'zod'

export const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD'])
export const modeSchema = z.enum(['PERSISTENT', 'SINGLE_MATCH'])
export const periodSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'PERMANENT'])
export const statusSchema = z.enum(['ACTIVE', 'CANCELLED', 'SUCCEEDED', 'FAILED', 'EXPIRED'])
const matchIdSchema = z.string().regex(/^[1-9]\d{0,19}$/)

export const challengeSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  difficulty: difficultySchema,
  mode: modeSchema,
  period: periodSchema.default('PERMANENT'),
  xpReward: z.number(),
  seasonPointsReward: z.number(),
  allowedMatchModes: z.array(z.number()),
  availableFrom: z.string().nullable().default(null),
  availableUntil: z.string().nullable().default(null),
  requiredHeroId: z.number().nullable().default(null),
  requiredItemIds: z.array(z.number()).default([]),
  rules: z.array(z.object({ metric: z.string(), operator: z.string(), value: z.union([z.number(), z.boolean()]) })),
})

export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  challenge: challengeSchema,
  status: statusSchema,
  activatedAt: z.string(),
  expiresAt: z.string().nullable().default(null),
  attemptsChecked: z.number(),
  completedAt: z.string().nullable(),
  completedByMatchId: matchIdSchema.nullable(),
  completedByMatch: z.object({ id: matchIdSchema, startedAt: z.string(), duration: z.number().nullable(), matchMode: z.number().nullable() }).nullable(),
})

export type Challenge = z.infer<typeof challengeSchema>
export type Enrollment = z.infer<typeof enrollmentSchema>
export type Difficulty = z.infer<typeof difficultySchema>
export type ChallengeMode = z.infer<typeof modeSchema>
export type ChallengePeriod = z.infer<typeof periodSchema>
export type ChallengeStatus = z.infer<typeof statusSchema>

export const difficultyLabel: Record<Difficulty, string> = { EASY: 'ЛЕГКО', MEDIUM: 'СРЕДНЕ', HARD: 'СЛОЖНО' }
export const modeLabel: Record<ChallengeMode, string> = { PERSISTENT: 'Постоянное', SINGLE_MATCH: 'За один матч' }
export const periodLabel: Record<ChallengePeriod, string> = { DAILY: 'Ежедневное', WEEKLY: 'Еженедельное', MONTHLY: 'Ежемесячное', PERMANENT: 'Постоянное' }
export const statusLabel: Record<ChallengeStatus, string> = { ACTIVE: 'Активно', CANCELLED: 'Отменено', SUCCEEDED: 'Выполнено', FAILED: 'Не выполнено', EXPIRED: 'Истекло' }
