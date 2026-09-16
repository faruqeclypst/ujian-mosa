import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'lucide-react': path.resolve(__dirname, './src/lib/icons/phosphor-bridge.tsx'),
    },
  },
  server: {
    host: true, // atau '0.0.0.0'
    port: 5173,
    proxy: {
      '/r2-proxy': {
        target: 'https://pub-a1193e163fef41c9afc15d1334b8740b.r2.dev',
        changeOrigin: true,
        secure: false, // Tambahkan ini untuk mengabaikan kendala SSL Node
        rewrite: (path) => path.replace(/^\/r2-proxy/, '')
      }
    }
  }
})
