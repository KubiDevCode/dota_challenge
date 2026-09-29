import { Module } from '@nestjs/common'
import { PrismaClient as BackendPrismaClient } from '@aegis-trials/backend/generated/client'
import { AuthModule } from '../auth/auth.module'
import { DatabaseModule } from '../database'
import { PrismaService } from '../database/prisma.service'
import { StratzModule } from '../integrations/stratz'
import { UsersModule } from '../users/users.module'
import { MatchHistoryController } from './match-history.controller'
import { MatchHistoryService } from './match-history.service'
import { MatchProcessingService } from './match-processing.service'
import { MatchSyncController } from './match-sync.controller'
import { MatchSyncService } from './match-sync.service'

@Module({ imports: [DatabaseModule, StratzModule, AuthModule, UsersModule], controllers: [MatchHistoryController, MatchSyncController],
  providers: [
    { provide: BackendPrismaClient, useExisting: PrismaService },
    MatchProcessingService, MatchHistoryService, MatchSyncService,
  ], exports: [MatchProcessingService] })
export class MatchesModule {}
