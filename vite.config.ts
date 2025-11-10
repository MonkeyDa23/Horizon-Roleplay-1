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
        // Renamed the proxy route to /api/gateway to avoid potential conflicts with the "proxy" keyword.
        // This now matches the production rewrite rule in vercel.json.
        '/api/gateway': {
          target: env.VITE_DISCORD_BOT_URL,
          changeOrigin: true,
          // FIX: Corrected the invalid regular expression. It was causing a TypeScript error.
          rewrite: (path) => path.replace(/^\/api\/gateway/, ''),
        },
      },
    },
  }
})