import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '../../shared/api'
import { challengeSchema, enrollmentSchema } from './model'
import type { ChallengeMode, ChallengePeriod, Difficulty } from './model'

export type ChallengeFilters = { page: number; difficulty?: Difficulty; mode?: ChallengeMode; category?: string; period?: ChallengePeriod }
const listSchema = z.object({ items: z.array(challengeSchema), page: z.number(), limit: z.number() })

export const challengeKeys = {
  lists: ['challenges', 'list'] as const,
  list: (filters: ChallengeFilters) => ['challenges', 'list', filters] as const,
  mine: ['challenges', 'mine'] as const,
}

export function useChallenges(filters: ChallengeFilters) {
  return useQuery({
    queryKey: challengeKeys.list(filters),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ page: String(filters.page), limit: filters.period === 'DAILY' ? '3' : '20' })
      if (filters.difficulty) params.set('difficulty', filters.difficulty)
      if (filters.mode) params.set('mode', filters.mode)
      if (filters.category) params.set('category', filters.category)
      if (filters.period) params.set('period', filters.period)
      return listSchema.parse(await apiRequest<unknown>(`/challenges?${params}`, { signal }))
    },
  })
}

export function useMyChallenges() {
  return useQuery({
    queryKey: challengeKeys.mine,
    queryFn: async ({ signal }) => z.array(enrollmentSchema).parse(await apiRequest<unknown>('/me/challenges', { signal })),
  })
}
