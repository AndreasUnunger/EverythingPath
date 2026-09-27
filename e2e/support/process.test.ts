// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { command, parseFixtureResponse } from './process';
import { resources } from './test-data';

it('runs the workspace-installed Convex fixture CLI without a package-manager subprocess', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-installed-cli-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: { convex: 'fixture.cjs' } }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), token: process.env.CONVEX_OVERRIDE_ACCESS_TOKEN }));',
  );
  try {
    const output = await command(
      'fixture CLI probe',
      ['exec', 'convex', 'run', 'fixture:inspect', '{"literal":"$() spaced"}'],
      {
        cwd: directory,
        env: {
          NODE_ENV: 'test',
          PATH: '',
          CONVEX_DEPLOY_KEY: 'preview:test|synthetic-key',
          CONVEX_OVERRIDE_ACCESS_TOKEN: 'synthetic-personal-token',
        },
      },
    );
    expect(JSON.parse(output)).toEqual({
      args: ['run', 'fixture:inspect', '{"literal":"$() spaced"}'],
      cwd: directory,
      token: 'preview:test|synthetic-key',
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    'process.stderr.write("ArgumentValidationError: opaque-provider-secret\\n"); setInterval(() => {}, 1000);',
  );
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
      ['exec', 'convex', 'run', 'fixture:wait'],
      {
        cwd: directory,
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
    const timingText = await readFile(
      join(artifactDirectory, 'timings.jsonl'),
      'utf8',
    );
    expect(timingText).not.toContain('opaque-provider-secret');
    const timings = z
      .array(
        z.object({
          commandId: z.string(),
          stage: z.string(),
          status: z.string(),
          elapsedMs: z.number(),
        }),
      )
      .parse(
        timingText
          .trim()
          .split('\n')
          .map((line): unknown => JSON.parse(line)),
      );
    expect(timings).toMatchObject([
      { stage: 'production application server', status: 'started' },
      { stage: 'production application server', status: 'failed' },
    ]);
    expect(timings[1]!.commandId).toBe(timings[0]!.commandId);
    expect(timings[1]!.elapsedMs).toBeGreaterThan(timings[0]!.elapsedMs);
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

it('binds child CLI authentication to the declared preview key instead of a personal login', async () => {
  const output = await command(
    'preview authentication probe',
    [
      'exec',
      'node',
      '-e',
      'process.stdout.write(process.env.CONVEX_OVERRIDE_ACCESS_TOKEN ?? "personal-login-fallback")',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONVEX_DEPLOY_KEY:
          'preview:test-team:test-project|synthetic-preview-key',
        CONVEX_OVERRIDE_ACCESS_TOKEN: 'synthetic-personal-token',
      },
    },
  );
  expect(output).toBe('preview:test-team:test-project|synthetic-preview-key');
});
