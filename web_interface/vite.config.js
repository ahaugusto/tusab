import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const electronPkg = JSON.parse(readFileSync(resolve(__dirname, '../electron/package.json'), 'utf-8'))

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(electronPkg.version),
    __APP_YEAR__:    JSON.stringify(new Date().getFullYear()),
    __SUPPORT_EMAIL__: JSON.stringify('tusab@tusab.solutions'),
    __CNPJ__:        JSON.stringify('65.131.075/0001-57'),
  },
  build: {
    sourcemap: true,
  },
})
