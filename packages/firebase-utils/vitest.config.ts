import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve both source files and @testing-library/react to the same React
      // installation so they share one ReactCurrentDispatcher singleton.
      // Without this, Vite's CJS→ESM interop and Node.js's native require() each
      // produce separate instances of the CJS module.exports object, which breaks
      // hooks when renderHook renders a component from the Vite-processed side.
      react: fileURLToPath(new URL('../../node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('../../node_modules/react-dom', import.meta.url)),
    },
  },
  test: {
    deps: {
      // Inline testing-library and react-dom so they go through Vite's transform
      // and resolve react via the alias above, ensuring one shared module instance.
      inline: ['@testing-library/react', 'react-dom'],
    },
    globals: true,
    environment: 'jsdom', // For Firebase SDK
    env: {
      // Dummy Firebase config for tests
      NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef',
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
