import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runSchema } from './e2e/support/process';

const runPath = process.env.E2E_RUN_FILE;
if (!runPath)
  throw new Error(
    'Start with pnpm test:e2e; direct Playwright runs bypass required preview setup',
  );
const run = runSchema.parse(JSON.parse(readFileSync(runPath, 'utf8')));
if (!run.fixture) throw new Error('E2E preview is not bound');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  timeout: 60_000,
  globalTimeout: 720_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: true,
  outputDir: join(run.privateDirectory, 'test-results'),
  reporter: [['./e2e/support/reporter.ts']],
  use: {
    baseURL: run.baseURL,
    browserName: 'chromium',
    viewport: { width: 1194, height: 834 },
    hasTouch: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'authentication', testMatch: /auth\.setup\.ts/, retries: 0 },
    {
      name: 'chromium-tablet',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['authentication'],
    },
  ],
  webServer: {
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    command: 'pnpm exec tsx e2e/start-server.ts',
    url: run.baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_CONVEX_URL: run.fixture.convexUrl,
    },
  },
});
