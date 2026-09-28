import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RelyingParty } from 'openid'
import type { Request } from 'express'
import type { SteamIdentity } from './auth.types'

export interface SteamOpenIdProvider {
  createAuthenticationUrl(state: string): Promise<string>
  verifyCallback(request: Request, state: string): Promise<SteamIdentity>
}

export const STEAM_PROVIDER = Symbol('STEAM_PROVIDER')

export function steamIdentityFromClaimedIdentifier(claimedIdentifier: string | undefined): SteamIdentity {
  const match = typeof claimedIdentifier === 'string'
    ? /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedIdentifier)
    : null
  if (!match) throw new Error('Steam returned an invalid identity')
  return { steamId64: match[1] }
}

@Injectable()
export class SteamOpenIdService implements SteamOpenIdProvider {
  constructor(private readonly config: ConfigService) {}

  async createAuthenticationUrl(state: string): Promise<string> {
    const rp = this.relyingParty(state)
    return new Promise((resolve, reject) => {
      rp.authenticate('https://steamcommunity.com/openid', false, (error, url) => {
        if (error || !url) reject(new Error('Steam authentication could not be started'))
        else resolve(url)
      })
    })
  }

  async verifyCallback(request: Request, state: string): Promise<SteamIdentity> {
    const rp = this.relyingParty(state)
    const result = await new Promise<{ authenticated: boolean; claimedIdentifier?: string }>((resolve, reject) => {
      rp.verifyAssertion(request, (error, assertion) => {
        if (error || !assertion) reject(new Error('Steam assertion verification failed'))
        else resolve(assertion)
      })
    })

    if (!result.authenticated) {
      throw new Error('Steam assertion was not authenticated')
    }
    return steamIdentityFromClaimedIdentifier(result.claimedIdentifier)
  }

  private relyingParty(state: string): RelyingParty {
    const returnUrl = new URL(this.config.getOrThrow<string>('STEAM_RETURN_URL'))
    returnUrl.searchParams.set('state', state)
    return new RelyingParty(
      returnUrl.toString(),
      this.config.getOrThrow<string>('STEAM_REALM'),
      true, // Stateless mode uses provider-side check_authentication across API replicas.
      true,
      [],
    )
  }
}
