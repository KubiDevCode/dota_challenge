import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../auth/auth.decorators'
import { AuthGuard, RoleGuard } from '../auth/auth.guards'
import { AdminService } from './admin.service'
import { CreateChallengeDto, CreateSeasonDto, PatchChallengeDto, PatchSeasonDto, ReplaceLevelThresholdsDto } from './admin.dto'

@ApiTags('admin')
@ApiCookieAuth()
@Controller('admin')
@UseGuards(AuthGuard, RoleGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('challenges')
  listChallenges() { return this.admin.listChallenges() }

  @Post('challenges')
  createChallenge(@Body() body: CreateChallengeDto) {
    return this.admin.createChallenge(body)
  }

  @Patch('challenges/:id')
  patchChallenge(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchChallengeDto) {
    return this.admin.patchChallenge(id, body)
  }

  @Get('level-thresholds')
  listLevelThresholds() { return this.admin.listLevelThresholds() }

  @Patch('level-thresholds')
  replaceLevelThresholds(@Body() body: ReplaceLevelThresholdsDto) {
    return this.admin.replaceLevelThresholds(body)
  }

  @Get('seasons')
  listSeasons() { return this.admin.listSeasons() }

  @Post('seasons')
  createSeason(@Body() body: CreateSeasonDto) {
    return this.admin.createSeason(body)
  }

  @Patch('seasons/:id')
  patchSeason(@Param('id', ParseUUIDPipe) id: string, @Body() body: PatchSeasonDto) {
    return this.admin.patchSeason(id, body)
  }
}
