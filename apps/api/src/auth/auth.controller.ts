import { Controller, ForbiddenException, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AuthenticatedUser } from './auth.decorators'
import { AuthGuard } from './auth.guards'
import { AuthService } from './auth.service'
import type { CurrentUser } from './auth.types'

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Get('auth/steam')
  @ApiOperation({ summary: 'Start Steam OpenID login' })
  async steamLogin(@Req() request: Request, @Res() response: Response): Promise<void> {
    const state = this.auth.newLoginState()
    await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
    request.session.steamLoginState = state
    await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
    try {
      response.redirect(302, await this.auth.createSteamAuthenticationUrl(state))
    } catch {
      response.redirect(302, this.auth.frontendRedirect('failed'))
    }
  }

  @Get('auth/steam/callback')
  @ApiOperation({ summary: 'Complete Steam OpenID login' })
  async steamCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const state = typeof request.query.state === 'string' ? request.query.state : undefined
    if (!state || !request.session.steamLoginState || state !== request.session.steamLoginState) {
      response.redirect(302, this.auth.frontendRedirect('failed'))
      return
    }
    try {
      const userId = await this.auth.authenticateSteam(request, state)
      await new Promise<void>((resolve, reject) => request.session.regenerate((error) => error ? reject(error) : resolve()))
      request.session.userId = userId
      await new Promise<void>((resolve, reject) => request.session.save((error) => error ? reject(error) : resolve()))
      response.redirect(302, this.auth.frontendRedirect('success'))
    } catch {
      response.redirect(302, this.auth.frontendRedirect('failed'))
    }
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End the current session' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const origin = request.get('origin')
    if (!origin || origin !== new URL(this.config.getOrThrow<string>('APP_URL')).origin) {
      throw new ForbiddenException('Invalid request origin')
    }
    await new Promise<void>((resolve, reject) => {
      if (!request.session) return resolve()
      request.session.destroy((error) => error ? reject(error) : resolve())
    })
    response.clearCookie(this.config.getOrThrow<string>('SESSION_COOKIE_NAME'), {
      path: this.config.getOrThrow<string>('SESSION_COOKIE_PATH'),
      ...(this.config.get<string>('SESSION_COOKIE_DOMAIN') ? { domain: this.config.get<string>('SESSION_COOKIE_DOMAIN') } : {}),
      sameSite: 'lax',
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      httpOnly: true,
    })
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Current authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async me(@AuthenticatedUser() currentUser: CurrentUser): Promise<CurrentUser> {
    return currentUser
  }
}
