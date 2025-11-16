import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // FIX: Cast `process` to `any` to resolve TypeScript error about missing 'cwd' property.
  // This can happen in environments where Node.js types are not automatically recognized.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests from /api/proxy to the Discord bot URL
        '/api/proxy': {
          target: env.VITE_DISCORD_BOT_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
          // This ensures the secret API key is added on the server-side
          // during development and is never exposed to the browser.
          configure: (proxy, options) => {
            // FIX: Cast `proxy` to `any` to access the '.on()' method.
            // The type provided by Vite for the proxy server may be incomplete.
            (proxy as any).on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Authorization', env.VITE_DISCORD_BOT_API_KEY);
            });
          }
        }
      }
    }
  }
})