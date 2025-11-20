
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');

  // Default to localhost:3001 if the env var isn't set, ensuring dev always works
  const botUrl = env.VITE_DISCORD_BOT_URL || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/proxy': {
          target: botUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/proxy/, ''),
          configure: (proxy, options) => {
            (proxy as any).on('proxyReq', (proxyReq, req, res) => {
              // Inject the secret key securely
              proxyReq.setHeader('Authorization', env.VITE_DISCORD_BOT_API_KEY);
            });
            (proxy as any).on('error', (err, req, res) => {
              console.error('Proxy Error:', err);
            });
          }
        }
      }
    }
  }
})
