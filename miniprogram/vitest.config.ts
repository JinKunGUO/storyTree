import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:3001'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/__tests__/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils/**/*.ts', 'src/api/**/*.ts', 'src/store/**/*.ts', 'src/pkgStory/api/**/*.ts'],
    },
  },
})