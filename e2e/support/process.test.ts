// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { command, parseFixtureResponse } from './process';
import { resources } from './test-data';

it('handles silent null fixture results without hiding missing query results', () => {
  expect(parseFixtureResponse('seedIdentityProjection', '')).toBeNull();
  expect(parseFixtureResponse('cleanupCase', '\n')).toBeNull();
  expect(() => parseFixtureResponse('resetCase', '')).toThrow(
    'invalid response',
  );
  expect(() => parseFixtureResponse('inspectCase', '')).toThrow(
    'invalid response',
  );
  expect(parseFixtureResponse('resetCase', '{"campaignId":"test"}')).toEqual({
    campaignId: 'test',
  });
});

it('persists safe service diagnostics while a process is still running and closes it on timeout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-process-test-'));
  const runFile = join(directory, 'run.json');
  const artifactDirectory = join(directory, 'artifacts');
  await writeFile(
    runFile,
    JSON.stringify({
      resources,
      workspace: process.cwd(),
      sourceRoot: process.cwd(),
      privateDirectory: directory,
      artifactDirectory,
      envFile: join(directory, 'convex.env'),
      baseURL: 'http://127.0.0.1:49123',
    }),
  );
  try {
    const running = command(
      'production application server',
      [
        'exec',
        'node',
        '-e',
        'process.stderr.write("ArgumentValidationError: opaque-provider-secret\\n"); setInterval(() => {}, 1000);',
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, E2E_RUN_FILE: runFile },
        timeout: 2000,
      },
    );
    // Attach the rejection handler before observing the file, avoiding an
    // unhandled timeout rejection if a heavily loaded worker is delayed.
    const completed = running.then(
      () => 'unexpected success',
      (error: unknown) => (error instanceof Error ? error.message : 'failed'),
    );
    await expect
      .poll(
        async () =>
          await readFile(
            join(artifactDirectory, 'diagnostics.log'),
            'utf8',
          ).catch(() => ''),
        { timeout: 1500 },
      )
      .toBe(
        'production application server: Convex argument validation failed\n',
      );
    expect(await completed).toContain('process failed');
    expect(
      await readFile(join(artifactDirectory, 'stages.log'), 'utf8'),
    ).toContain('failed');
    expect(
      await readFile(join(artifactDirectory, 'diagnostics.log'), 'utf8'),
    ).not.toContain('opaque-provider-secret');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 10_000);

it('rejects a process that exits successfully after its deadline', async () => {
  await expect(
    command(
      'deadline test',
      [
        'exec',
        'node',
        '-e',
        'process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);',
      ],
      { cwd: process.cwd(), timeout: 1000 },
    ),
  ).rejects.toThrow('process failed');
}, 10_000);
