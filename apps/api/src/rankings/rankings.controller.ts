import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PageQueryDto } from '../pagination.dto'
import { RankingsService } from './rankings.service'

@ApiTags('seasons')
@Controller('seasons')
export class SeasonsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get('current')
  current() { return this.rankings.currentSeason() }
}

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly rankings: RankingsService) {}

  @Get()
  list(@Query() query: PageQueryDto) { return this.rankings.leaderboard(query) }
}

@ApiTags('users')
@Controller('users')
export class PublicProfilesController {
  constructor(private readonly rankings: RankingsService) {}

  @Get(':id/profile')
  profile(@Param('id', ParseUUIDPipe) id: string) { return this.rankings.publicProfile(id) }
}
