import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import gameAdminPlugin from './scripts/vite-plugin-game-admin.mjs'

/** Short commit of the build, shown in the UI to tell which deploy a player is running. */
const resolveBuildVersion = (): string => {
  // Netlify exposes the deployed commit as COMMIT_REF.
  const fromEnv = process.env.COMMIT_REF
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gameAdminPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(resolveBuildVersion()),
  },
})
