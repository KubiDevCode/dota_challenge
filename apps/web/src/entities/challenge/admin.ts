import { z } from 'zod'
import { apiRequest } from '../../shared/api'
export const challengeMetrics = ['win', 'kills', 'deaths', 'assists', 'killParticipation', 'lastHits', 'heroDamage', 'towerDamage', 'wardsPlaced', 'duration', 'heroId'] as const
export const metricLabel: Record<typeof challengeMetrics[number], string> = {
  win: 'Победа', kills: 'Убийства', deaths: 'Смерти', assists: 'Помощи', killParticipation: 'Участие в убийствах',
  lastHits: 'Добивания', heroDamage: 'Урон героям', towerDamage: 'Урон строениям', wardsPlaced: 'Варды', duration: 'Длительность матча (сек)', heroId: 'ID героя',
}
export const challengeModes = ['PERSISTENT', 'SINGLE_MATCH'] as const
export const challengeDifficulties = ['EASY', 'MEDIUM', 'HARD'] as const
export const publicationStatuses = ['DRAFT', 'PUBLISHED'] as const
export const matchModes = [{ id: 1, label: 'All Pick' }, { id: 22, label: 'Ranked All Pick' }] as const

export const ruleSchema = z.object({
  metric: z.enum(challengeMetrics), operator: z.enum(['EQ', 'GTE', 'LTE']), value: z.union([z.number(), z.boolean()]),
}).superRefine((rule, ctx) => {
  const integerMetrics = ['kills', 'deaths', 'assists', 'lastHits', 'wardsPlaced', 'heroId']
  if (rule.metric === 'win') {
    if (rule.operator !== 'EQ' || typeof rule.value !== 'boolean') ctx.addIssue({ code: 'custom', message: 'Для победы доступно только сравнение равно и значение да/нет', path: ['value'] })
  } else {
    if (typeof rule.value !== 'number' || !Number.isFinite(rule.value) || rule.value < 0) ctx.addIssue({ code: 'custom', message: 'Введите неотрицательное число', path: ['value'] })
    if (rule.metric === 'heroId' && rule.operator !== 'EQ') ctx.addIssue({ code: 'custom', message: 'Для ID героя доступен только оператор равно', path: ['operator'] })
    if (integerMetrics.includes(rule.metric) && !Number.isSafeInteger(rule.value)) ctx.addIssue({ code: 'custom', message: 'Для этой метрики нужно целое число', path: ['value'] })
    if (rule.metric === 'heroId' && typeof rule.value === 'number' && rule.value < 1) ctx.addIssue({ code: 'custom', message: 'ID героя должен быть больше нуля', path: ['value'] })
    if (rule.metric === 'killParticipation' && typeof rule.value === 'number' && rule.value > 1) ctx.addIssue({ code: 'custom', message: 'Укажите долю от 0 до 1', path: ['value'] })
  }
})

const adminChallengeSchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), category: z.string(), difficulty: z.enum(challengeDifficulties), mode: z.enum(challengeModes),
  xpReward: z.number(), seasonPointsReward: z.number(), allowedMatchModes: z.array(z.number()), publicationStatus: z.enum(publicationStatuses),
  availableFrom: z.string().nullable(), rules: z.array(ruleSchema),
})
export type AdminChallenge = z.infer<typeof adminChallengeSchema>
export type ChallengeInput = Omit<AdminChallenge, 'id' | 'availableFrom' | 'rules'> & { availableFrom: string | null; rules: z.infer<typeof ruleSchema>[] }

export function listAdminChallenges(signal?: AbortSignal) {
  return apiRequest<AdminChallenge[]>('/admin/challenges', { signal }).then((rows) => z.array(adminChallengeSchema).parse(rows))
}
export function createAdminChallenge(body: ChallengeInput) {
  return apiRequest<AdminChallenge>('/admin/challenges', { method: 'POST', body })
}
export function updateAdminChallenge(id: string, body: Partial<ChallengeInput>) {
  return apiRequest<AdminChallenge>(`/admin/challenges/${encodeURIComponent(id)}`, { method: 'PATCH', body })
}
