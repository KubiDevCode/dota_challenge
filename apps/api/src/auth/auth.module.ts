import { Injectable, Logger, MiddlewareConsumer, Module, NestMiddleware, NestModule, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisStore } from 'connect-redis'
import session from 'express-session'
import { createClient, type RedisClientType } from 'redis'
import type { NextFunction, Request, Response } from 'express'
import { DatabaseModule } from '../database'
import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AuthGuard, RoleGuard } from './auth.guards'
import { AuthService } from './auth.service'
import { STEAM_PROVIDER } from './steam-openid.provider'
import { SteamOpenIdService } from './steam-openid.provider'

@Injectable()
class AuthSessionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthSessionMiddleware.name)
  private readonly redis: RedisClientType | undefined
  private connectPromise: Promise<void> | undefined
  readonly handler: ReturnType<typeof session>

  constructor(config: ConfigService) {
    const production = config.getOrThrow<string>('NODE_ENV') === 'production'
    if (!production && config.get<string>('NODE_ENV') === 'test') {
      this.handler = session({
        name: config.getOrThrow<string>('SESSION_COOKIE_NAME'),
        secret: config.getOrThrow<string>('SESSION_SECRET'),
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: this.cookieOptions(config),
      })
      return
    }

    this.redis = createClient({ url: config.getOrThrow<string>('REDIS_URL') })
    this.redis.on('error', (error) => this.logger.error(`Redis session store error: ${error.message}`))
    this.handler = session({
      name: config.getOrThrow<string>('SESSION_COOKIE_NAME'),
      secret: config.getOrThrow<string>('SESSION_SECRET'),
      store: new RedisStore({ client: this.redis, prefix: 'aegis:sess:', ttl: Math.floor(config.getOrThrow<number>('SESSION_MAX_AGE_MS') / 1000) }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: this.cookieOptions(config),
    })
  }

  async use(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      await this.connect()
      this.handler(request, response, next)
    } catch (error) {
      next(error)
    }
  }

  async connect(): Promise<void> {
    if (!this.redis || this.redis.isOpen) return
    if (!this.connectPromise) {
      this.connectPromise = this.redis.connect()
        .then(() => undefined)
        .finally(() => { this.connectPromise = undefined })
    }
    await this.connectPromise
  }

  async close(): Promise<void> {
    if (this.redis?.isOpen) await this.redis.quit()
  }

  private cookieOptions(config: ConfigService): session.CookieOptions {
    return {
      httpOnly: true,
      secure: config.getOrThrow<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: config.getOrThrow<string>('SESSION_COOKIE_PATH'),
      ...(config.get<string>('SESSION_COOKIE_DOMAIN') ? { domain: config.get<string>('SESSION_COOKIE_DOMAIN') } : {}),
      maxAge: config.getOrThrow<number>('SESSION_MAX_AGE_MS'),
    }
  }
}

@Injectable()
class CsrfMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next()
    const origin = request.get('origin')
    const trustedOrigin = new URL(this.config.getOrThrow<string>('APP_URL')).origin
    if (origin !== trustedOrigin) {
      response.status(403).json({ statusCode: 403, message: 'Invalid request origin' })
      return
    }
    next()
  }
}

@Module({
  imports: [DatabaseModule, UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    RoleGuard,
    SteamOpenIdService,
    { provide: STEAM_PROVIDER, useExisting: SteamOpenIdService },
    AuthSessionMiddleware,
    CsrfMiddleware,
  ],
  exports: [AuthGuard, RoleGuard],
})
export class AuthModule implements NestModule, OnModuleInit, OnModuleDestroy {
  constructor(private readonly sessions: AuthSessionMiddleware) {}

  configure(consumer: MiddlewareConsumer): void { consumer.apply(AuthSessionMiddleware, CsrfMiddleware).forRoutes('*') }
  onModuleInit(): Promise<void> { return this.sessions.connect() }
  onModuleDestroy(): Promise<void> { return this.sessions.close() }
}
