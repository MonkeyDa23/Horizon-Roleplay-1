
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // FIX: Cast `process` to `any` to resolve TypeScript type error for `cwd` property.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests from /api/proxy to the bot during development
        // This avoids CORS and Mixed Content errors locally.
        '/api/proxy': {
          target: env.VITE_DISCORD_BOT_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/proxy/, ''),
        },
      },
    },
  }
})
