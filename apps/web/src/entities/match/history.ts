import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '../../shared/api'

const matchSchema = z.object({
  matchId: z.string(), win: z.boolean().nullable(), kills: z.number().nullable(), deaths: z.number().nullable(), assists: z.number().nullable(),
  killParticipation: z.number().nullable(), lastHits: z.number().nullable(), heroDamage: z.number().nullable(),
  towerDamage: z.number().nullable(), wardsPlaced: z.number().nullable(), heroId: z.number().nullable(),
  startedAt: z.string(), duration: z.number().nullable(), matchMode: z.number().nullable(),
})
const pageSchema = z.object({ items: z.array(matchSchema), page: z.number(), limit: z.number(), hasMore: z.boolean() })
export type Match = z.infer<typeof matchSchema>

export function useMatchHistory(page: number) {
  return useQuery({
    queryKey: ['my-matches', page],
    queryFn: async ({ signal }) => pageSchema.parse(await apiRequest(`/me/matches?page=${page}&limit=20`, { signal })),
    retry: false,
  })
}
