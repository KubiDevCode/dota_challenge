import { resolve } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { validateEnvironment } from './config/environment'
import { HealthController } from './health.controller'
import { DatabaseModule } from './database'
import { ChallengesModule } from './challenges/challenges.module'
import { AuthModule } from './auth/auth.module'
import { StratzModule } from './integrations/stratz'
import { MatchesModule } from './matches/matches.module'

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: resolve(__dirname, '../../../.env'),
    validate: validateEnvironment,
  }), DatabaseModule, ChallengesModule, AuthModule, StratzModule, MatchesModule],
  controllers: [HealthController],
})
export class AppModule {}
