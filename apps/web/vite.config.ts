import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { API_PREFIX } from '@aegis-trials/shared'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../..', import.meta.url))
  const env = loadEnv(mode, envDir, '')

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        [API_PREFIX]: { target: `http://127.0.0.1:${env.API_PORT || 3000}` },
      },
    },
  }
})
