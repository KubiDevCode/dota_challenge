import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import type { Request } from 'express'
import type { SteamIdentity } from './auth.types'
import type { SteamOpenIdProvider } from './steam-openid.provider'
import { STEAM_PROVIDER } from './steam-openid.provider'
import { UsersService } from '../users/users.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @Inject(STEAM_PROVIDER) private readonly steam: SteamProvider,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  newLoginState(): string { return randomBytes(32).toString('base64url') }

  async createSteamAuthenticationUrl(state: string): Promise<string> {
    return this.steam.createAuthenticationUrl(state)
  }

  async authenticateSteam(request: Request, state: string): Promise<string> {
    const identity = await this.steam.verifyCallback(request, state)
    const profile = await this.loadSteamProfile(identity.steamId64)
    const user = await this.users.findOrCreateFromSteam({ ...identity, ...profile })
    return user.id
  }

  frontendRedirect(result: 'success' | 'failed'): string {
    const target = new URL(this.config.getOrThrow<string>('APP_URL'))
    if (result === 'failed') target.searchParams.set('steamAuth', 'failed')
    return target.toString()
  }

  private async loadSteamProfile(steamId64: string): Promise<Pick<SteamIdentity, 'displayName' | 'avatarUrl'>> {
    const apiKey = this.config.get<string>('STEAM_API_KEY')
    if (!apiKey) return {}
    try {
      const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('steamids', steamId64)
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!response.ok) return {}
      const payload: unknown = await response.json()
      if (!payload || typeof payload !== 'object') return {}
      const responseData = (payload as { response?: { players?: unknown } }).response
      const player = Array.isArray(responseData?.players) ? responseData.players[0] : undefined
      if (!player || typeof player !== 'object') return {}
      const record = player as { personaname?: unknown; avatarfull?: unknown; steamid?: unknown }
      if (record.steamid !== steamId64) return {}
      return {
        ...(typeof record.personaname === 'string' ? { displayName: record.personaname } : {}),
        ...(typeof record.avatarfull === 'string' ? { avatarUrl: record.avatarfull } : {}),
      }
    } catch (error) {
      this.logger.warn(`Steam profile lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      return {}
    }
  }
}

export type SteamProvider = SteamOpenIdProvider
