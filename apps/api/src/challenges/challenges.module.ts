import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database'
import { ChallengesController, MyChallengesController } from './challenges.controller'
import { ChallengesRepository } from './challenges.repository'
import { ChallengesService } from './challenges.service'

@Module({ imports: [DatabaseModule], controllers: [ChallengesController, MyChallengesController], providers: [ChallengesRepository, ChallengesService] })
export class ChallengesModule {}
