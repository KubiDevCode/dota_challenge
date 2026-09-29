import { Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { AuthenticatedUser } from '../auth/auth.decorators'
import { AuthGuard } from '../auth/auth.guards'
import type { CurrentUser } from '../auth/auth.types'
import { MatchSyncService } from './match-sync.service'

@ApiTags('matches')
@ApiCookieAuth()
@Controller('me')
@UseGuards(AuthGuard)
export class MatchSyncController {
  constructor(private readonly sync: MatchSyncService) {}

  @Post('matches/refresh')
  refresh(@AuthenticatedUser() user: CurrentUser) { return this.sync.refresh(user.id) }

  @Get('match-sync-status')
  status(@AuthenticatedUser() user: CurrentUser) { return this.sync.status(user.id) }
}
