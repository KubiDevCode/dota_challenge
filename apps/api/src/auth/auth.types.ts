import type { UserRole } from '../database/generated/enums'

export interface CurrentUser {
  id: string
  steamId64: string
  accountId32: number
  displayName: string
  avatarUrl: string | null
  role: UserRole
  totalXp: number
}

export interface SteamIdentity {
  steamId64: string
  displayName?: string
  avatarUrl?: string
}

declare module 'express-session' {
  interface SessionData {
    steamLoginState?: string
    userId?: string
  }
}
