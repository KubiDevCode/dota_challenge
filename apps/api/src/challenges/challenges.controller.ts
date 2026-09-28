import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { requireCurrentUserId } from '../common/current-user'
import type { AuthenticatedRequest } from '../common/current-user'
import { ActivateChallengeBodyDto, ListChallengesQueryDto } from './challenges.dto'
import { ChallengesService } from './challenges.service'

@ApiTags('challenges')
@Controller('challenges')
export class ChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@Query() query: ListChallengesQueryDto) { return this.challenges.list(query) }

  @Post(':id/activate')
  activate(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: ActivateChallengeBodyDto) {
    void body
    return this.challenges.activate(requireCurrentUserId(request), id)
  }
}

@ApiTags('challenges')
@Controller('me/challenges')
export class MyChallengesController {
  constructor(private readonly challenges: ChallengesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.challenges.listMine(requireCurrentUserId(request))
  }

  @Delete(':userChallengeId')
  cancel(@Req() request: AuthenticatedRequest, @Param('userChallengeId', ParseUUIDPipe) id: string) {
    return this.challenges.cancel(requireCurrentUserId(request), id)
  }
}
