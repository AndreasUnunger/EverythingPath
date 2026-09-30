// @vitest-environment node
import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { setupStages, slotLockGuidance } from './setup-failure';

// Every probe runs the real runner and its real error path in a child
// process; these assertions read that process's actual stdout and stderr.
const probePath = join(import.meta.dirname, 'testing', 'runner-probe.ts');
const secret = 'PROBESECRET';
let base: string;
let fakeBin: string;
beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), 'e2e-runner-boundary-'));
  // A git stand-in that prints a secret to stderr and fails.
  fakeBin = join(base, 'bin');
  await mkdir(fakeBin);
  await writeFile(
    join(fakeBin, 'git'),
    `#!/bin/sh\necho "fatal: https://x.test/?token=sk_test_${secret}" >&2\nexit 1\n`,
  );
  await chmod(join(fakeBin, 'git'), 0o755);
});
afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

let probes = 0;
async function probe(scenario: string, options: { fakeGit?: boolean } = {}) {
  // A hostile working directory: control characters and a secret.
  const root = join(
    base,
    `root-${probes++}-\u001b[31m-sk_test_${secret}-\r-token=${secret}`,
  );
  await mkdir(root, { recursive: true });
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', probePath, scenario, root],
    {
      env: {
        ...process.env,
        PATH: options.fakeGit
          ? `${fakeBin}:${process.env.PATH ?? ''}`
          : process.env.PATH,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const code = await new Promise<number | null>((resolve) =>
    child.on('close', resolve),
  );
  const lock = /^PROBE-LOCK (.*)$/m.exec(stdout)?.[1];
  const output = stdout.replace(/^PROBE-LOCK .*\n/m, '');
  for (const text of [output, stderr]) {
    expect(text).not.toContain(secret);
    expect(text).not.toContain('sk_test');
    expect(text).not.toContain('token=');
    expect(text).not.toContain('https://x.test');
    expect(text).not.toContain(root);
    expect(text).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f]/);
  }
  return { code, stdout: output, stderr: stderr.trimEnd().split('\n'), lock };
}

it('labels a failure in every stage of the real runner, whatever its message says', async () => {
  const results = await Promise.all(
    setupStages.map(async (stage) => [stage, await probe(`stage:${stage}`)]),
  );
  for (const [stage, result] of results as [
    string,
    Awaited<ReturnType<typeof probe>>,
  ][]) {
    expect(result.code).toBe(1);
    const errorClass =
      stage === 'arguments'
        ? 'validation'
        : stage === 'deployment'
          ? 'exit-1'
          : 'unknown';
    expect(result.stderr).toEqual([
      `E2E setup failed: ${stage} (${errorClass})`,
    ]);
    // A failure after the slot lock is acquired still releases it.
    expect(result.lock).toBe('none');
  }
}, 120_000);

it('prints only the fixed text of a known harness condition', async () => {
  expect((await probe('usage')).stderr).toEqual([
    'Usage: pnpm test:e2e --resources /absolute/resources.json [--secrets /absolute/test-secrets.env] [--preflight] [--nightly] [--workers N]',
    'E2E setup failed: arguments (validation)',
  ]);
  expect((await probe('diagnostic')).stderr).toEqual([
    'E2E preflight: Clerk secret key must be a test key',
    'E2E setup failed: resources (validation)',
  ]);
}, 60_000);

it('never forwards a subprocess stderr', async () => {
  for (const scenario of ['git-fingerprint', 'git-copy']) {
    const result = await probe(scenario, { fakeGit: true });
    expect(result.code).toBe(1);
    expect(result.stderr).toEqual([
      'E2E setup failed: source-snapshot (exit-1)',
    ]);
  }
}, 60_000);

it('names generated bindings only from the closed file set', async () => {
  expect((await probe('generated-list')).stderr).toEqual([
    'Convex generated-code drift (file list); regenerate and review before E2E',
    'E2E setup failed: generated-bindings (validation)',
  ]);
  expect((await probe('generated-file')).stderr).toEqual([
    'Convex generated-code drift (another generated file); regenerate and review before E2E',
    'E2E setup failed: generated-bindings (validation)',
  ]);
}, 60_000);

it('keeps a command failure primary when its stages.log write then fails', async () => {
  const result = await probe('log-failure');
  expect(result.code).toBe(1);
  expect(result.stderr).toEqual([
    'E2E setup failed: deployment (exit-3)',
    'E2E evidence log also failed (EISDIR)',
  ]);
}, 60_000);

it('reports an existing slot lock with a relative path and leaves it', async () => {
  const result = await probe('locked');
  expect(result.code).toBe(1);
  expect(result.stderr).toEqual([
    'E2E setup failed: slot already locked (active or stale)',
    'Lock: e2e/.private/e2e-local-test-slot-0.lock (created 2026-09-30T05:40:40.453Z)',
    slotLockGuidance,
  ]);
  expect(result.lock).toMatch(/"owner":"[0-9a-f-]{36}"/);
}, 60_000);

it('releases only its own lock and never a replacement', async () => {
  const replaced = await probe('replaced-lock');
  expect(replaced.code).toBe(1);
  expect(replaced.stderr).toEqual([
    'E2E setup failed: deployment (exit-1)',
    'E2E cleanup also failed: slot-lock (validation)',
    'E2E slot lock was removed or replaced during the run; any replacement was left in place',
  ]);
  expect(replaced.lock).toBe(
    '{"owner":"00000000-0000-4000-8000-000000000000","createdAt":"2026-09-30T05:40:40.453Z"}',
  );
  const released = await probe('released-lock');
  expect(released.stderr).toEqual([
    'E2E nightly results are incomplete or unsuccessful',
  ]);
  expect(released.stdout).toContain(
    'Safe evidence: e2e-artifacts/e2e-local-test-slot-0/everythingpath-e2e-',
  );
  expect(released.lock).toBe('none');
}, 60_000);
