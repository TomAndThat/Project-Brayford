import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Email configuration for tests
      EMAIL_DEV_MODE: 'true',
      POSTMARK_API_KEY: 'test-api-key',
      POSTMARK_FROM_EMAIL: 'test@example.com',
      POSTMARK_FROM_NAME: 'Test Sender',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.*',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
  },
});
