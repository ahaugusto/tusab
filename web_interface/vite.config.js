import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Versão única do Tusab: a do package.json da extensão (tusab-mcp/).
const extensaoPkg = JSON.parse(readFileSync(resolve(__dirname, '../tusab-mcp/package.json'), 'utf-8'))

// Modo extensão (vite build --mode extensao): a interface é servida pelo plugin
// MCP do Tusab, sem nada carregado de fora (CSP 'self'). Remove as fontes do
// Google do index.html, não gera sourcemaps (pacote menor) e troca o SDK do
// Microsoft Clarity (telemetria do antigo app desktop) por um módulo vazio: o
// pacote da extensão não leva código que envia dados para fora. O layout "elk"
// da Mermaid (elkjs, EPL-2.0) também fica de fora.
function modoExtensao() {
  let ativo = false
  return {
    name: 'tusab-modo-extensao',
    config(_cfg, { mode }) {
      ativo = mode === 'extensao'
      return ativo
        ? {
            build: { sourcemap: false },
            resolve: {
              alias: {
                '@microsoft/clarity': resolve(__dirname, 'src/services/clarity-vazio.js'),
                // Layout opcional da Mermaid (EPL-2.0/GPL-3.0): fora do pacote. Ver elk-vazio.js.
                'elkjs/lib/elk.bundled.js': resolve(__dirname, 'src/services/elk-vazio.js'),
              },
            },
          }
        : undefined
    },
    transformIndexHtml(html) {
      if (!ativo) return html
      return html.replace(/\s*<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/g, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), modoExtensao()],
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
      '/canal-search': 'http://127.0.0.1:8001',
      '/playlists-canal': 'http://127.0.0.1:8001',
      '/drive-auth': 'http://127.0.0.1:8001',
      '/open-folder': 'http://127.0.0.1:8001',
      '/neural': 'http://127.0.0.1:8001',
      '/historico': 'http://127.0.0.1:8001',
      '/reset-total': 'http://127.0.0.1:8001',
      '/export': 'http://127.0.0.1:8001',
      '/agent': 'http://127.0.0.1:8001',
      '/log': 'http://127.0.0.1:8001',
      '/arxiv': 'http://127.0.0.1:8001',
      '/fhir': 'http://127.0.0.1:8001',
      '/auto-update': 'http://127.0.0.1:8001',
      '/drive-disconnect': 'http://127.0.0.1:8001',
      '/import': 'http://127.0.0.1:8001',
      '/metrics': 'http://127.0.0.1:8001',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(extensaoPkg.version),
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
