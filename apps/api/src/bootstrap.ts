import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpAdapterHost, NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { API_PREFIX, APP_NAME } from '@aegis-trials/shared'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './http-exception.filter'

export function createValidationPipe() {
  return new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
}

export async function createApplication() {
  const app = await NestFactory.create(AppModule, { abortOnError: false })
  if (app.get(ConfigService).get<string>('NODE_ENV') === 'production') app.getHttpAdapter().getInstance().set('trust proxy', 1)
  app.setGlobalPrefix(API_PREFIX.slice(1))
  app.useGlobalPipes(createValidationPipe())
  app.useGlobalFilters(new HttpExceptionFilter(app.get(HttpAdapterHost)))
  app.enableShutdownHooks()

  const config = new DocumentBuilder()
    .setTitle(`${APP_NAME} API`)
    .setDescription('Foundation infrastructure endpoints. No business API yet.')
    .setVersion('0.0.1')
    .build()
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: `${API_PREFIX}/openapi.json`,
  })

  return app
}
