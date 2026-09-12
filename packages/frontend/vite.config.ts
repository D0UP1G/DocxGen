import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
      // The audio service is separate from the document service. This rule
      // must be explicit: otherwise /api/audio/transcribe is sent to port 3001
      // and Vite returns an HTML 404 page, which looks like a JSON.parse error.
      proxy: {
        '/api/audio': { target: 'http://127.0.0.1:3005', changeOrigin: true, configure: (proxy) => proxy.on('error', (error) => console.error('[audio proxy]', error.message)) },
        '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
        '/health': { target: 'http://127.0.0.1:3001', changeOrigin: true },
      },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
