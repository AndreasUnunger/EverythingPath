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
    ],
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
