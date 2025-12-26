import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'https://api.docsops.me',
        changeOrigin: true,
        secure: false,
      },
      '/audit-api': {
        target: 'https://api.docsops.me',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/audit-api/, '/api/v2'),
      }
    }
  }
})

