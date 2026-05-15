import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['js/**/*.js'],
    },
  },
});