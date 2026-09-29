import { useQuery } from '@tanstack/react-query'
import { getLeaderboard } from './api'

export function useLeaderboard(page: number) {
  return useQuery({
    queryKey: ['leaderboard', page],
    queryFn: () => getLeaderboard(page),
    retry: false,
  })
}
