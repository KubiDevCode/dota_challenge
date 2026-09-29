import { apiRequest } from '../../shared/api'
import type { LeaderboardPageData } from './types'

export function getLeaderboard(page: number, limit = 20) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest<LeaderboardPageData>(`/leaderboard?${params}`)
}
