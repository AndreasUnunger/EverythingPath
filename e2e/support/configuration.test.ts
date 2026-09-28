// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import {
  resources,
  deploymentFixture,
  threeCohortResources,
} from './test-data';

it.each(['mandatory', 'nightly'] as const)(
  'discovers %s authentication, browser journeys and deployed persistence without credentials',
  async (mode) => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-config-test-'));
    try {
      const path = join(directory, 'run.json');
      await writeFile(
        path,
        JSON.stringify({
          mode,
          resources,
          fixture: deploymentFixture,
          workspace: process.cwd(),
          sourceRoot: process.cwd(),
          privateDirectory: directory,
          artifactDirectory: join(directory, 'artifacts'),
          envFile: join(directory, 'convex.env'),
          baseURL: 'http://127.0.0.1:49123',
        }),
      );
      const result = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', '--list', '--reporter=list'],
        {
          encoding: 'utf8',
          env: { ...process.env, E2E_RUN_FILE: path },
          timeout: 15_000,
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(0);
      expect(result.stdout).toContain('[authentication]');
      expect(result.stdout).toContain('[chromium-tablet]');
      expect(result.stdout).toContain('existing-militia.spec.ts');
      expect(result.stdout).toContain('character-ledger.spec.ts');
      expect(result.stdout).toContain('complete-week.spec.ts');
      expect(result.stdout).toContain('realtime-action-slot.spec.ts');
      expect(result.stdout).toContain('[canonical-persistence]');
      expect(result.stdout).toContain('[canonical-confirmation]');
      expect(result.stdout).toContain('canonical-confirmation.spec.ts');
      expect(result.stdout).toContain('canonical-persistence.spec.ts');
      expect(result.stdout).toContain(
        'shared Confirmation contract commits reviewed weeks in isolated Convex',
      );
      expect(result.stdout).toContain('[canonical-workspace]');
      expect(result.stdout).toContain('canonical-workspace.spec.ts');
      expect(result.stdout).toContain('[canonical-cutover]');
      expect(result.stdout).toContain('canonical-cutover.spec.ts');
      expect(result.stdout).toContain(
        mode === 'nightly' ? 'Total: 41 tests' : 'Total: 20 tests',
      );
      if (mode === 'nightly') {
        expect(result.stdout).toContain('[webkit-tablet]');
        expect(result.stdout).toContain('[firefox-desktop]');
        expect(result.stdout).toContain('[chromium-phone]');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);

it.each([
  ['accepts', threeCohortResources, 3, 0],
  ['refuses', resources, 2, 1],
] as const)(
  '%s one Playwright worker per declared cohort',
  async (_label, declared, workers, status) => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-config-cohorts-'));
    try {
      const path = join(directory, 'run.json');
      await writeFile(
        path,
        JSON.stringify({
          mode: 'nightly',
          workers,
          resources: declared,
          fixture: {
            ...deploymentFixture,
            workers: declared.workers.map((worker) => ({
              ...worker,
              cases: deploymentFixture.workers[0]!.cases,
            })),
          },
          workspace: process.cwd(),
          sourceRoot: process.cwd(),
          privateDirectory: directory,
          artifactDirectory: join(directory, 'artifacts'),
          envFile: join(directory, 'convex.env'),
          baseURL: 'http://127.0.0.1:49123',
        }),
      );
      const result = spawnSync(
        'pnpm',
        ['exec', 'playwright', 'test', '--list', '--reporter=list'],
        {
          encoding: 'utf8',
          env: { ...process.env, E2E_RUN_FILE: path },
          timeout: 15_000,
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(status);
      if (status === 0) expect(result.stdout).toContain('Total: 41 tests');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20_000,
);
