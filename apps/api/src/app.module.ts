import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnvironment } from './config/environment'
import { HealthController } from './health.controller'
import { DatabaseModule } from './database'
import { ChallengesModule } from './challenges/challenges.module'
import { AuthModule } from './auth/auth.module'
import { OpenDotaModule } from './integrations/opendota'
import { MatchesModule } from './matches/matches.module'
import { RankingsModule } from './rankings/rankings.module'
import { AdminModule } from './admin/admin.module'

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: resolve(__dirname, '../../../.env'),
    validate: validateEnvironment,
  }), DatabaseModule, ChallengesModule, AuthModule, AdminModule, OpenDotaModule, MatchesModule, RankingsModule],
  controllers: [HealthController],
})
export class AppModule {}
