export interface Season {
  id: string
  name: string
  startsAt: string
  endsAt: string
}

export interface LeaderboardPageData {
  season: Season
  items: LeaderboardEntry[]
  page: number
  limit: number
  hasMore: boolean
}

export interface LeaderboardEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  totalXp: number
  level: { level: number; rankName: string } | null
  seasonalScore: number
  position: number
}
