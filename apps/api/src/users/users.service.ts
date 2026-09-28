import { Injectable } from '@nestjs/common'
import { Prisma } from '../database/generated/client'
import type { UserModel } from '../database/generated/models'
import { PrismaService } from '../database/prisma.service'
import type { CurrentUser, SteamIdentity } from '../auth/auth.types'

const STEAM_ID_BASE = 76561197960265728n
const MAX_ACCOUNT_ID = 0xffff_ffffn

export function getAccountId32(steamId64: string): bigint {
  if (!/^\d{17}$/.test(steamId64)) throw new Error('Invalid SteamID64')
  const id = BigInt(steamId64)
  const accountId = id - STEAM_ID_BASE
  if (accountId < 0n || accountId > MAX_ACCOUNT_ID) throw new Error('Invalid SteamID64')
  return accountId
}

export function toCurrentUser(user: Pick<UserModel, 'id' | 'steamId64' | 'accountId32' | 'displayName' | 'avatarUrl' | 'role' | 'totalXp'>): CurrentUser {
  return {
    id: user.id,
    steamId64: user.steamId64,
    accountId32: Number(user.accountId32),
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    totalXp: user.totalXp,
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserModel | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async findOrCreateFromSteam(identity: SteamIdentity): Promise<UserModel> {
    const accountId32 = getAccountId32(identity.steamId64)
    const profile = this.profileFields(identity)

    try {
      return await this.prisma.user.upsert({
        where: { steamId64: identity.steamId64 },
        create: {
          steamId64: identity.steamId64,
          accountId32,
          displayName: profile.displayName ?? identity.steamId64,
          avatarUrl: profile.avatarUrl,
          role: 'USER',
        },
        update: profile,
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      // Another callback may have won the unique-key race. Resolve the canonical row.
      const existing = await this.prisma.user.findUnique({ where: { steamId64: identity.steamId64 } })
      if (existing) return existing
      throw error
    }
  }

  private profileFields(identity: SteamIdentity): { displayName?: string; avatarUrl?: string } {
    const fields: { displayName?: string; avatarUrl?: string } = {}
    const displayName = identity.displayName?.trim().split('').filter((character) => {
      const code = character.charCodeAt(0)
      return code > 31 && code !== 127
    }).join('').slice(0, 128)
    if (displayName) fields.displayName = displayName
    if (identity.avatarUrl) {
      try {
        const avatar = new URL(identity.avatarUrl)
        if (avatar.protocol === 'https:' && avatar.hostname === 'avatars.steamstatic.com') fields.avatarUrl = avatar.toString()
      } catch { /* Ignore an unusable profile field. */ }
    }
    return fields
  }
}
