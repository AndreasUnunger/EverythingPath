// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { resources, deploymentFixture } from './test-data';

it('loads the real Playwright config and discovers the serial setup and tablet smoke without credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-config-test-'));
  try {
    const path = join(directory, 'run.json');
    await writeFile(
      path,
      JSON.stringify({
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
    expect(result.stdout).toContain('Total: 2 tests');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
