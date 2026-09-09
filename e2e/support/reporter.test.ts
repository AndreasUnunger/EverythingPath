// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { resources } from './test-data';
import { evaluateResults } from './results';

// Exercise the actual reporter/Playwright protocol without browser or service
// dependencies. These synthetic bodies test result handling, not authentication.
it.each(['passed', 'skipped', 'focused', 'quarantined', 'retry'] as const)(
  'the reporter and Playwright agree on a %s required journey',
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-reporter-test-'));
    const runFile = join(directory, 'run.json');
    const artifactDirectory = join(directory, 'artifacts');
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    try {
      await writeFile(
        runFile,
        JSON.stringify({
          resources,
          workspace: directory,
          sourceRoot: process.cwd(),
          privateDirectory: directory,
          artifactDirectory,
          envFile: join(directory, 'convex.env'),
          baseURL: 'http://localhost:49123',
        }),
      );
      await writeFile(
        join(directory, 'auth.setup.ts'),
        `import { test } from ${playwright}; test('prepare fresh role sessions', () => {});`,
      );
      const modifier =
        mode === 'skipped' ? '.skip' : mode === 'focused' ? '.only' : '';
      const options = mode === 'quarantined' ? `{ tag: '@quarantined' },` : '';
      const body =
        mode === 'retry'
          ? `if (info.retry === 0) throw new Error('Synthetic first attempt failure');`
          : '';
      await writeFile(
        join(directory, 'access.spec.ts'),
        `import { test } from ${playwright}; test${modifier}('organization members can open their campaign and outsiders cannot', ${options} async ({}, info) => { ${body} });`,
      );
      await writeFile(
        join(directory, 'existing-militia.spec.ts'),
        `import { test } from ${playwright}; test('existing militia state survives reload within its campaign', () => {});`,
      );
      await writeFile(
        join(directory, 'character-ledger.spec.ts'),
        `import { test } from ${playwright}; test('players share character and officer assignment changes', () => {});`,
      );
      const config = join(directory, 'playwright.config.ts');
      await writeFile(
        config,
        `export default {
        testDir: ${JSON.stringify(directory)}, workers: 1, forbidOnly: true,
        retries: 1, reporter: [[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],
        projects: [
          { name: 'authentication', testMatch: 'auth.setup.ts', retries: 0 },
          { name: 'chromium-tablet', testMatch: '*.spec.ts', dependencies: ['authentication'] },
        ],
      };`,
      );
      const result = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', '--config', config],
        {
          env: { ...process.env, E2E_RUN_FILE: runFile },
          encoding: 'utf8',
          timeout: 15_000,
        },
      );
      const report: unknown = JSON.parse(
        await readFile(join(artifactDirectory, 'report.json'), 'utf8'),
      );
      expect(result.status, result.stdout + result.stderr).toBe(
        mode === 'passed' ? 0 : 1,
      );
      expect(evaluateResults(report)).toBe(mode === 'passed');
      expect(
        await readFile(join(artifactDirectory, 'report.html'), 'utf8'),
      ).toContain(`E2E ${mode === 'passed' ? 'passed' : 'failed'}`);
      if (mode === 'retry')
        expect(report).toMatchObject({
          tests: expect.arrayContaining([
            expect.objectContaining({
              file: 'access.spec.ts',
              results: [
                { status: 'failed', retry: 0 },
                { status: 'passed', retry: 1 },
              ],
            }),
          ]),
        });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);
