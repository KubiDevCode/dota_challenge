export function validateEnvironment(env: Record<string, unknown>) {
  const nodeEnv = env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(String(nodeEnv))) {
    throw new Error('NODE_ENV must be development, test or production')
  }

  const apiPort = Number(env.API_PORT ?? 3000)
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535')
  }

  const apiHost = env.API_HOST ?? '127.0.0.1'
  if (typeof apiHost !== 'string' || !apiHost.trim()) {
    throw new Error('API_HOST must be a non-empty string')
  }

  const urlVariable = (name: string, fallback?: string) => {
    const value = env[name] ?? fallback
    if (typeof value !== 'string') throw new Error(`${name} must be an absolute HTTP(S) URL`)
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || !url.host) throw new Error()
      return url.toString().replace(/\/$/, '')
    } catch {
      throw new Error(`${name} must be an absolute HTTP(S) URL`)
    }
  }

  if (nodeEnv === 'production' && ['APP_URL', 'STEAM_REALM', 'STEAM_RETURN_URL'].some((key) => !env[key])) {
    throw new Error('APP_URL, STEAM_REALM and STEAM_RETURN_URL must be configured in production')
  }
  const appUrl = urlVariable('APP_URL', 'http://localhost:5173')
  const steamRealm = urlVariable('STEAM_REALM', 'http://localhost:3000/api/auth/steam')
  const steamReturnUrl = urlVariable('STEAM_RETURN_URL', 'http://localhost:3000/api/auth/steam/callback')
  if (nodeEnv === 'production' && [appUrl, steamRealm, steamReturnUrl].some((value) => new URL(value).protocol !== 'https:')) {
    throw new Error('APP_URL, STEAM_REALM and STEAM_RETURN_URL must use HTTPS in production')
  }
  if (!steamReturnUrl.startsWith(`${steamRealm}/`) && steamReturnUrl !== steamRealm) {
    throw new Error('STEAM_RETURN_URL must be within STEAM_REALM')
  }

  const redisUrl = env.REDIS_URL ?? (nodeEnv === 'test' ? 'redis://localhost:6379' : undefined)
  if (typeof redisUrl !== 'string' || !/^rediss?:\/\//.test(redisUrl)) {
    throw new Error('REDIS_URL must be configured as a redis:// or rediss:// URL')
  }

  const sessionSecret = env.SESSION_SECRET
  if (typeof sessionSecret !== 'string' && nodeEnv !== 'test') throw new Error('SESSION_SECRET must be configured outside tests')
  if (sessionSecret !== undefined && (typeof sessionSecret !== 'string' || sessionSecret.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  if (typeof sessionSecret === 'string' && /^(replace-with|change-me|generate-)/i.test(sessionSecret)) {
    throw new Error('SESSION_SECRET must be replaced with a random secret')
  }

  const sessionCookieDomain = env.SESSION_COOKIE_DOMAIN
  if (sessionCookieDomain !== undefined && (typeof sessionCookieDomain !== 'string' || !sessionCookieDomain.trim() || sessionCookieDomain.includes('/'))) {
    throw new Error('SESSION_COOKIE_DOMAIN must be a hostname without a path')
  }
  const sessionCookiePath = env.SESSION_COOKIE_PATH ?? '/'
  if (typeof sessionCookiePath !== 'string' || !sessionCookiePath.startsWith('/')) {
    throw new Error('SESSION_COOKIE_PATH must start with /')
  }
  const sessionMaxAgeMs = Number(env.SESSION_MAX_AGE_MS ?? 604800000)
  if (!Number.isInteger(sessionMaxAgeMs) || sessionMaxAgeMs < 60000 || sessionMaxAgeMs > 2592000000) {
    throw new Error('SESSION_MAX_AGE_MS must be between 60000 and 2592000000')
  }

  try {
    if (typeof env.DATABASE_URL !== 'string' || !env.DATABASE_URL.trim()) throw new Error()
    const url = new URL(env.DATABASE_URL)
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error()
    }
  } catch {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a host and database name')
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    API_PORT: apiPort,
    API_HOST: apiHost,
    APP_URL: appUrl,
    REDIS_URL: redisUrl,
    STEAM_REALM: steamRealm,
    STEAM_RETURN_URL: steamReturnUrl,
    SESSION_SECRET: sessionSecret ?? 'test-only-session-secret-0000000000000000',
    SESSION_COOKIE_NAME: env.SESSION_COOKIE_NAME ?? 'aegis.sid',
    SESSION_COOKIE_PATH: sessionCookiePath,
    SESSION_COOKIE_DOMAIN: sessionCookieDomain,
    SESSION_MAX_AGE_MS: sessionMaxAgeMs,
    STEAM_API_KEY: env.STEAM_API_KEY,
  }
}
