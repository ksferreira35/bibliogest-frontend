import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      reporter: ['text', 'html', 'lcov', 'json-summary', 'json'],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
    setupFiles: ['./tests/setup.js'],
    restoreMocks: true,
    clearMocks: true,
  },
})
