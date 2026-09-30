import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MATCH_PROVIDER } from '../match-provider'
import { OpenDotaMatchProvider } from './opendota.provider'

@Module({
  providers: [{
    provide: MATCH_PROVIDER,
    inject: [ConfigService],
    useFactory: (config: ConfigService) => new OpenDotaMatchProvider({
      apiKey: config.get<string>('OPENDOTA_API_KEY'),
      timeoutMs: config.get<number>('OPENDOTA_TIMEOUT_MS'),
    }),
  }],
  exports: [MATCH_PROVIDER],
})
export class OpenDotaModule {}
