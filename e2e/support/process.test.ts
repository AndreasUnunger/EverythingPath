// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';
import {
  command,
  canonicalPersistenceFixtureCall,
  fixtureCall,
  isolateCases,
  parseFixtureResponse,
  runSchema,
  withIsolationCanary,
} from './process';
import { resources } from './test-data';

it('uses the current deployment epoch for each new fixture write and leaves inspections read-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-fixture-epoch-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  const run = runSchema.parse({
    resources,
    workspace: directory,
    sourceRoot: directory,
    privateDirectory: directory,
    artifactDirectory: join(directory, 'artifacts'),
    envFile: join(directory, 'convex.env'),
    baseURL: 'http://127.0.0.1:49123',
  });
  await writeFile(run.envFile, '');
  await writeFile(join(directory, 'epoch'), '2');
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    `const fs = require('node:fs');
const [, operation, serialized, ...selection] = process.argv.slice(2);
if (JSON.stringify(selection) !== JSON.stringify(${JSON.stringify(['--preview-name', resources.previewName, '--env-file', run.envFile])})) process.exit(1);
const args = JSON.parse(serialized);
const epoch = Number(fs.readFileSync('epoch', 'utf8'));
if (operation === 'initialMigration:clientStatus') {
  process.stdout.write(JSON.stringify({ status: 'ready', epoch }));
} else {
  const inspect = operation === 'e2eFixtures:inspectCase';
  if (inspect ? 'writeEpoch' in args : args.writeEpoch !== epoch) process.exit(2);
  if (!inspect) fs.writeFileSync('epoch', String(epoch + 2));
  if (!['e2eFixtures:seedIdentityProjection', 'e2eFixtures:cleanupCase'].includes(operation)) process.stdout.write(JSON.stringify(args));
}`,
  );
  isolateCases(['existingMilitia']);
  try {
    expect(await fixtureCall(run, 'resetCase', { caseKey: 'smoke' })).toEqual({
      caseKey: 'smoke',
      isolatedWith: ['smoke', 'existingMilitia'],
      writeEpoch: 2,
    });
    expect(await fixtureCall(run, 'seedIdentityProjection', {})).toBeNull();
    expect(await fixtureCall(run, 'cleanupCase', {})).toBeNull();
    expect(
      await fixtureCall(run, 'resetCase', { caseKey: 'smoke' }),
    ).toMatchObject({
      writeEpoch: 8,
    });
    expect(await fixtureCall(run, 'inspectCase', { caseKey: 'smoke' })).toEqual(
      {
        caseKey: 'smoke',
      },
    );
  } finally {
    isolateCases([]);
    await rm(directory, { recursive: true, force: true });
  }
});

it('uses a fresh epoch for canonical persistence fixture writes while preserving inspection and null results', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'canonical-fixture-epoch-'));
  const packageDirectory = join(directory, 'node_modules', 'convex');
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({ name: 'convex', bin: 'fixture.cjs' }),
  );
  const run = runSchema.parse({
    resources,
    workspace: directory,
    sourceRoot: directory,
    privateDirectory: directory,
    artifactDirectory: join(directory, 'artifacts'),
    envFile: join(directory, 'convex.env'),
    baseURL: 'http://127.0.0.1:49123',
  });
  await writeFile(run.envFile, '');
  await writeFile(join(directory, 'epoch'), '4');
  await writeFile(
    join(packageDirectory, 'fixture.cjs'),
    `const fs = require('node:fs');
const [, operation, serialized, ...selection] = process.argv.slice(2);
if (JSON.stringify(selection) !== JSON.stringify(${JSON.stringify(['--preview-name', resources.previewName, '--env-file', run.envFile])})) process.exit(1);
const args = JSON.parse(serialized);
const epoch = Number(fs.readFileSync('epoch', 'utf8'));
if (operation === 'initialMigration:clientStatus') {
  process.stdout.write(JSON.stringify({ status: 'ready', epoch }));
} else {
  const inspect = operation === 'canonicalPersistenceFixtures:inspect';
  if (inspect ? 'writeEpoch' in args : args.writeEpoch !== epoch) process.exit(2);
  if (!inspect) fs.writeFileSync('epoch', String(epoch + 2));
  if (!['close', 'changeSource', 'blockSuccessor', 'installAcceptanceSource', 'appendHistory'].some(name => operation === 'canonicalPersistenceFixtures:' + name)) process.stdout.write(JSON.stringify(args));
}`,
  );
  isolateCases(['isolation']);
  try {
    expect(
      await canonicalPersistenceFixtureCall(run, 'initialize', {}),
    ).toEqual({ writeEpoch: 4 });
    expect(
      await canonicalPersistenceFixtureCall(run, 'resetAndInitialize', {
        scope: { caseKey: 'smoke' },
      }),
    ).toEqual({
      scope: { caseKey: 'smoke' },
      isolatedWith: ['smoke', 'isolation'],
      writeEpoch: 6,
    });
    for (const operation of [
      'close',
      'changeSource',
      'blockSuccessor',
      'installAcceptanceSource',
      'appendHistory',
    ] as const) {
      expect(
        await canonicalPersistenceFixtureCall(run, operation, {}),
      ).toBeNull();
    }
    expect(
      await canonicalPersistenceFixtureCall(run, 'initializeUpkeep', {}),
    ).toEqual({ writeEpoch: 18 });
    expect(
      await canonicalPersistenceFixtureCall(run, 'inspect', {
        campaignId: 'campaign',
      }),
    ).toEqual({ campaignId: 'campaign' });
  } finally {
    isolateCases([]);
    await rm(directory, { recursive: true, force: true });
  }
});

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

it('sends the running test cases with every reset for the isolation canary', () => {
  const scope = { namespace: 'n', workerKey: 'worker-1', token: 't' };
  isolateCases(['existingMilitia', 'isolation']);
  try {
    expect(
      withIsolationCanary('resetCase', { ...scope, caseKey: 'isolation' }),
    ).toMatchObject({ isolatedWith: ['isolation', 'existingMilitia'] });
    expect(
      withIsolationCanary('resetAndInitialize', {
        scope: { ...scope, caseKey: 'existingMilitia' },
        draftId: 'draft',
      }),
    ).toMatchObject({ isolatedWith: ['existingMilitia', 'isolation'] });
    const inspect = { ...scope, caseKey: 'isolation' };
    expect(withIsolationCanary('inspectCase', inspect)).toBe(inspect);
    isolateCases([]);
    expect(
      withIsolationCanary('resetCase', { ...scope, caseKey: 'smoke' }),
    ).toMatchObject({ isolatedWith: ['smoke'] });
    expect(() =>
      withIsolationCanary('resetCase', { ...scope, caseKey: 'unknown' }),
    ).toThrow();
  } finally {
    isolateCases([]);
  }
});
