import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// The ViaCRM API has no CORS: the browser always talks to it through this same-origin proxy (dev) or nginx (docker).
const api = process.env.VITE_API_URL || 'http://localhost:5080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/v1': {
        target: api,
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
