import { Injectable } from '@nestjs/common'
import type { OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    super({ adapter: new PrismaPg({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      connectionTimeoutMillis: 5000,
    }) })
  }

  // Connect on the first query so the liveness endpoint remains independent.
  async onModuleDestroy(): Promise<void> { await this.$disconnect() }
}
