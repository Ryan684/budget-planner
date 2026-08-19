import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Port 8001, not 8000: the Pi is shared with the family dashboard, which owns
    // 8000. Dev matches production so the two apps can also run side by side on a
    // laptop. See the "Shared Raspberry Pi" section of the README.
    proxy: {
      '/api': 'http://localhost:8001',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
