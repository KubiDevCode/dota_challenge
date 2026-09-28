import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database'
import { AuthModule } from '../auth/auth.module'
import { UsersModule } from '../users/users.module'
import { ChallengesController, MyChallengesController } from './challenges.controller'
import { ChallengesRepository } from './challenges.repository'
import { ChallengesService } from './challenges.service'

@Module({ imports: [DatabaseModule, AuthModule, UsersModule], controllers: [ChallengesController, MyChallengesController], providers: [ChallengesRepository, ChallengesService] })
export class ChallengesModule {}
