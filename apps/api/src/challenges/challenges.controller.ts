import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthenticatedUser } from '../auth/auth.decorators'
import { AuthGuard } from '../auth/auth.guards'
import type { CurrentUser } from '../auth/auth.types'
import { ActivateChallengeBodyDto, ListChallengesQueryDto } from './challenges.dto'
import { ChallengesService } from './challenges.service'

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@Query() query: ListChallengesQueryDto) { return this.challenges.list(query) }

  @Post(':id/activate')
  @UseGuards(AuthGuard)
  activate(@AuthenticatedUser() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: ActivateChallengeBodyDto) {
    void body
    return this.challenges.activate(user.id, id)
  }
}

@ApiTags('challenges')
@Controller('me/challenges')
@UseGuards(AuthGuard)
export class MyChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@AuthenticatedUser() user: CurrentUser) {
    return this.challenges.listMine(user.id)
  }

  @Delete(':userChallengeId')
  cancel(@AuthenticatedUser() user: CurrentUser, @Param('userChallengeId', ParseUUIDPipe) id: string) {
    return this.challenges.cancel(user.id, id)
  }
}
