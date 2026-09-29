import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { AuthenticatedUser } from '../auth/auth.decorators'
import { AuthGuard } from '../auth/auth.guards'
import type { CurrentUser } from '../auth/auth.types'
import { PageQueryDto } from '../pagination.dto'
import { MatchHistoryService } from './match-history.service'

@ApiTags('matches')
@ApiCookieAuth()
@Controller('me/matches')
@UseGuards(AuthGuard)
export class MatchHistoryController {
  constructor(private readonly history: MatchHistoryService) {}

  @Get()
  list(@AuthenticatedUser() user: CurrentUser, @Query() query: PageQueryDto) {
    return this.history.listMine(user.id, query)
  }
}
