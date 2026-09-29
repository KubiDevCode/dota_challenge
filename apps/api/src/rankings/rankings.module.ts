import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database'
import { LeaderboardController, PublicProfilesController, SeasonsController } from './rankings.controller'
import { RankingsService } from './rankings.service'

@Module({
  imports: [DatabaseModule],
  controllers: [SeasonsController, LeaderboardController, PublicProfilesController],
  providers: [RankingsService],
})
export class RankingsModule {}
