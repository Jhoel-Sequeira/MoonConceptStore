import { defineConfig } from 'vite'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const frontendDir = dirname(fileURLToPath(import.meta.url))
const certificateDir = resolve(frontendDir, '.cert')
const httpsOptions = existsSync(resolve(certificateDir, 'server-cert.pem'))
  ? {
      key: readFileSync(resolve(certificateDir, 'server-key.pem')),
      cert: readFileSync(resolve(certificateDir, 'server-cert.pem')),
    }
  : undefined

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    https: httpsOptions,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
