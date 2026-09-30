import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'convex/**/*.test.ts',
      'tests/**/*.test.ts',
      'e2e/support/**/*.test.ts',
    ],
    // UI tests are CPU-bound in jsdom (role queries spend most of their time
    // in getComputedStyle). The 4-vCPU CI runner runs them about 2.2x slower
    // than a local run pinned to 4 CPUs: [rules.P83.details] takes 2.2 s
    // locally and hit 5 s in CI, where 33 tests exceed half the default.
    // Local runs keep Vitest's 5 s default so slow tests stay visible.
    testTimeout: process.env.CI === 'true' ? 15_000 : 5_000,
    clearMocks: true,
    mockReset: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@convex': path.resolve(__dirname, './convex'),
    },
  },
});
