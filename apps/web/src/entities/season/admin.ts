import { z } from 'zod'
import { apiRequest } from '../../shared/api'

export const seasonStatus = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED'])
export const adminSeasonSchema = z.object({ id: z.string(), name: z.string(), startsAt: z.string(), endsAt: z.string(), status: seasonStatus })
export type AdminSeason = z.infer<typeof adminSeasonSchema>
export type SeasonInput = Omit<AdminSeason, 'id'>
export const thresholdSchema = z.object({ level: z.number().int().min(1), requiredTotalXp: z.number().int().min(0), rankName: z.string().trim().min(1).max(128) })
export type LevelThreshold = z.infer<typeof thresholdSchema>

export function listAdminSeasons(signal?: AbortSignal) {
  return apiRequest<AdminSeason[]>('/admin/seasons', { signal }).then((rows) => z.array(adminSeasonSchema).parse(rows))
}
export function saveSeason(body: SeasonInput, id?: string) {
  return apiRequest<AdminSeason>(id ? `/admin/seasons/${encodeURIComponent(id)}` : '/admin/seasons', { method: id ? 'PATCH' : 'POST', body })
}
export function listThresholds(signal?: AbortSignal) {
  return apiRequest<LevelThreshold[]>('/admin/level-thresholds', { signal }).then((rows) => z.array(thresholdSchema).parse(rows))
}
export function replaceThresholds(thresholds: LevelThreshold[]) {
  return apiRequest<LevelThreshold[]>('/admin/level-thresholds', { method: 'PATCH', body: { thresholds } })
}
