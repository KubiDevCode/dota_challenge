import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '../../shared/api'

const levelSchema = z.object({ level: z.number(), requiredTotalXp: z.number(), rankName: z.string() })
const currentUserSchema = z.object({
  id: z.string(), steamId64: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), totalXp: z.number(),
  role: z.enum(['USER', 'ADMIN']),
})
const publicProfileSchema = z.object({
  id: z.string(), displayName: z.string(), avatarUrl: z.string().nullable(), totalXp: z.number(),
  level: levelSchema.nullable(), seasonalScore: z.number(), seasonId: z.string().nullable(), completedChallenges: z.number(),
})
const enrollmentSchema = z.object({ status: z.string(), completedByMatchId: z.string().nullable().optional(), challenge: z.object({ title: z.string() }).optional() })

export type PublicProfile = z.infer<typeof publicProfileSchema>

export function useCurrentUser() {
  return useQuery({ queryKey: ['me'], queryFn: async ({ signal }) => currentUserSchema.parse(await apiRequest('/me', { signal })), retry: false })
}

export function usePublicProfile(id: string | undefined) {
  return useQuery({
    queryKey: ['public-profile', id], enabled: Boolean(id),
    queryFn: async ({ signal }) => publicProfileSchema.parse(await apiRequest(`/users/${encodeURIComponent(id!)}/profile`, { signal })),
    retry: false,
  })
}

export function useMyChallengeSummary(enabled: boolean) {
  return useQuery({
    queryKey: ['my-challenges'], enabled,
    queryFn: async ({ signal }) => {
      const rows = z.array(enrollmentSchema).parse(await apiRequest('/me/challenges', { signal }))
      return {
        active: rows.filter((row) => row.status === 'ACTIVE').length,
        completed: rows.filter((row) => row.status === 'SUCCEEDED').length,
        completions: rows.filter((row) => row.status === 'SUCCEEDED' && row.completedByMatchId && row.challenge).map((row) => ({ matchId: row.completedByMatchId!, title: row.challenge!.title })),
      }
    }, retry: false,
  })
}
