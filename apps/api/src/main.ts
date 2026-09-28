import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createApplication } from './bootstrap'

async function bootstrap() {
  const app = await createApplication()
  const config = app.get(ConfigService)
  await app.listen(config.getOrThrow<number>('API_PORT'), config.getOrThrow<string>('API_HOST'))
  Logger.log(`API: ${await app.getUrl()}/api; Swagger: /api/docs`, 'Bootstrap')
}

void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.message : 'API startup failed', undefined, 'Bootstrap')
  process.exitCode = 1
})
