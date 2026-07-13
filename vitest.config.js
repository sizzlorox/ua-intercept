import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/chrome-mock.js'],
    include: ['tests/unit/**/*.test.js'],
  },
})
