import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // FIX: Cast `process` to `any` to resolve TypeScript type error for `cwd` property.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
  }
})