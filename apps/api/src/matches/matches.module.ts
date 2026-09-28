import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database'
import { StratzModule } from '../integrations/stratz'
import { MatchProcessingService } from './match-processing.service'

@Module({ imports: [DatabaseModule, StratzModule], providers: [MatchProcessingService], exports: [MatchProcessingService] })
export class MatchesModule {}
