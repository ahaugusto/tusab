import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const electronPkg = JSON.parse(readFileSync(resolve(__dirname, '../electron/package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
      '/status': 'http://127.0.0.1:8001',
      '/history': 'http://127.0.0.1:8001',
      '/repositorio': 'http://127.0.0.1:8001',
      '/relatorio': 'http://127.0.0.1:8001',
      '/set-channel': 'http://127.0.0.1:8001',
      '/start': 'http://127.0.0.1:8001',
      '/pause': 'http://127.0.0.1:8001',
      '/cancel': 'http://127.0.0.1:8001',
      '/queue': 'http://127.0.0.1:8001',
      '/canal-info': 'http://127.0.0.1:8001',
      '/drive-auth': 'http://127.0.0.1:8001',
      '/open-folder': 'http://127.0.0.1:8001',
      '/neural': 'http://127.0.0.1:8001',
      '/historico': 'http://127.0.0.1:8001',
      '/reset-total': 'http://127.0.0.1:8001',
      '/export': 'http://127.0.0.1:8001',
      '/agent': 'http://127.0.0.1:8001',
      '/log': 'http://127.0.0.1:8001',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(electronPkg.version),
    __APP_YEAR__:    JSON.stringify(new Date().getFullYear()),
    __SUPPORT_EMAIL__: JSON.stringify('tusab@tusab.solutions'),
    __CNPJ__:        JSON.stringify('65.131.075/0001-57'),
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-gfm')) {
            return 'vendor-markdown';
          }
        },
      },
    },
  },
})
