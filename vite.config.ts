import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import gameAdminPlugin from './scripts/vite-plugin-game-admin.mjs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gameAdminPlugin()],
})
