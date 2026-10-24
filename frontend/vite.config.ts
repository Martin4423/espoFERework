import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/client': {
        target: process.env.VITE_ESPO_URL || 'http://localhost:8091',
        changeOrigin: true,
      },
      '/api': {
        target: process.env.VITE_ESPO_URL || 'http://localhost:8091',
        changeOrigin: true,
      },
    },
  },
})
