import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_NAME } from '@aegis-trials/shared'

const envPath = resolve(__dirname, '../../../.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

// Keep the standalone process alive until a real queue consumer is introduced.
// This timer performs no polling, network requests or business work.
const keepAlive = setInterval(() => {}, 60_000)

function shutdown() {
  clearInterval(keepAlive)
  process.off('SIGINT', shutdown)
  process.off('SIGTERM', shutdown)
  console.info(`${APP_NAME} worker stopped`)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
console.info(`${APP_NAME} worker started (idle; no queues connected)`)
