import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MATCH_PROVIDER } from '../match-provider'
import { StratzMatchProvider } from './stratz.provider'

@Module({
  providers: [{
    provide: MATCH_PROVIDER,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => new StratzMatchProvider({
      token: config.get<string>('STRATZ_API_TOKEN'),
      timeoutMs: config.get<number>('STRATZ_TIMEOUT_MS'),
    }),
  }],
  exports: [MATCH_PROVIDER],
})
export class StratzModule {}
