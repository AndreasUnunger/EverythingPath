// @vitest-environment node
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { expect, it } from 'vitest';
import { z } from 'zod';
import { CommandEvidenceFailure, CommandFailure } from './process';
import {
  acquireSlotLock,
  classifyError,
  CleanupFailure,
  failureReport,
  isErrorClass,
  SetupFailure,
  setupStage,
  setupStages,
  withCleanup,
} from './setup-failure';

const secretMessage =
  'request to https://api.clerk.com/v1/users?key=sk_test_SyntheticSecret123 failed with sk_test_SyntheticSecret123';
function systemError(code: string) {
  return Object.assign(new Error(`${code}: open '/private/${code}'`), {
    code,
  });
}
async function failureOf(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('expected a failure');
    },
    (error: unknown) => error,
  );
}
function printed(error: unknown) {
  return failureReport(error).join('\n');
}

it('labels a failure with the stage that was running', async () => {
  for (const stage of setupStages) {
    const failure = await failureOf(
      setupStage(stage, () => {
        throw systemError('ENOENT');
      }),
    );
    expect(failure).toBeInstanceOf(SetupFailure);
    expect(failure).toMatchObject({ stage, errorClass: 'ENOENT' });
    expect(printed(failure)).toBe(`E2E setup failed: ${stage} (ENOENT)`);
  }
  expect(await setupStage('port', () => 4321)).toBe(4321);
});

it('keeps the innermost stage and labels a command evidence failure', async () => {
  const inner = await failureOf(
    setupStage('resources', () => {
      throw systemError('EACCES');
    }),
  );
  expect(
    await failureOf(
      setupStage('deployment', () => {
        throw inner;
      }),
    ),
  ).toBe(inner);
  expect(
    printed(
      await failureOf(
        setupStage('deployment', () => {
          throw new CommandEvidenceFailure(
            'preview deployment and web build',
            systemError('ENOENT'),
          );
        }),
      ),
    ),
  ).toBe(
    'preview deployment and web build: evidence could not be initialized\nE2E setup failed: evidence (ENOENT)',
  );
});

it('maps errors only to the closed class set', () => {
  const cases: [unknown, string][] = [
    [systemError('ENOENT'), 'ENOENT'],
    [systemError('EEXIST'), 'EEXIST'],
    [systemError('ETIMEDOUT'), 'ETIMEDOUT'],
    [systemError('ECONNREFUSED'), 'ECONNREFUSED'],
    [systemError('UND_ERR_CONNECT_TIMEOUT'), 'ETIMEDOUT'],
    [
      new TypeError('fetch failed', { cause: systemError('ENOTFOUND') }),
      'ENOTFOUND',
    ],
    [new CommandFailure('deploy: process failed (2)', 2), 'exit-2'],
    [
      new CommandFailure('deploy: process failed (terminated)', null),
      'terminated',
    ],
    [
      new CommandFailure('deploy: process could not start', null, 'ENOENT'),
      'ENOENT',
    ],
    [Object.assign(new Error('git failed'), { status: 128 }), 'exit-128'],
    [
      Object.assign(new Error('git killed'), {
        status: null,
        signal: 'SIGTERM',
      }),
      'terminated',
    ],
    [new DOMException('aborted', 'TimeoutError'), 'timeout'],
    [
      new Error('E2E execution exceeded seventeen and a half minutes'),
      'timeout',
    ],
    [z.string().safeParse(1).error, 'validation'],
    [new SyntaxError('Unexpected token'), 'validation'],
    [
      (() => {
        try {
          parseArgs({ args: ['--nope'], options: {}, strict: true });
        } catch (error) {
          return error;
        }
      })(),
      'validation',
    ],
    [new Error('E2E preflight: missing target'), 'validation'],
    [new Error(secretMessage), 'unknown'],
    [systemError('sk_test_SyntheticSecret123'), 'unknown'],
    [Object.assign(new Error('x'), { status: 1_000 }), 'unknown'],
    [new CommandFailure('odd', 0), 'unknown'],
    ['a thrown string', 'unknown'],
    [undefined, 'unknown'],
    [null, 'unknown'],
  ];
  for (const [error, expected] of cases) {
    const errorClass = classifyError(error);
    expect(errorClass).toBe(expected);
    expect(isErrorClass(errorClass)).toBe(true);
  }
  expect(isErrorClass('sk_test_SyntheticSecret123')).toBe(false);
  expect(isErrorClass('exit-0')).toBe(false);
  expect(isErrorClass('exit-256')).toBe(false);
});

it('never prints a secret-looking message, name, stack, cause or code', async () => {
  const hostile = Object.assign(
    new Error(secretMessage, { cause: new Error(secretMessage) }),
    { name: 'sk_test_SyntheticSecret123', code: 'https://x.test/?key=abc' },
  );
  const failure = await failureOf(
    setupStage('clerk-verification', () => {
      throw hostile;
    }),
  );
  const cleanup = await failureOf(
    withCleanup(
      () => Promise.reject(hostile),
      [['temporary-directory', () => Promise.reject(hostile)]],
    ),
  );
  for (const error of [failure, cleanup, hostile]) {
    const output = printed(error);
    expect(output).not.toMatch(/sk_test|https?:|key=|Synthetic/);
  }
  expect(printed(failure)).toBe(
    'E2E setup failed: clerk-verification (unknown)',
  );
  expect(failure).not.toHaveProperty('cause');
  expect(JSON.stringify(failure)).not.toContain('sk_test');
  expect((failure as Error).stack).not.toContain('sk_test');
  expect(printed(hostile)).toBe(
    'E2E failed after setup; inspect the safe evidence directory.',
  );
});

it('keeps the harness allowlisted diagnostics next to the stage', async () => {
  expect(
    printed(
      await failureOf(
        setupStage('arguments', () => {
          throw new Error('Usage: pnpm test:e2e --resources /absolute/x.json');
        }),
      ),
    ),
  ).toBe(
    'Usage: pnpm test:e2e --resources /absolute/x.json\nE2E setup failed: arguments (validation)',
  );
  expect(
    printed(
      await failureOf(
        setupStage('deployment', () =>
          Promise.reject(
            new CommandFailure(
              'preview deployment and web build: process failed (1)',
              1,
            ),
          ),
        ),
      ),
    ),
  ).toBe(
    'preview deployment and web build: process failed (1)\nE2E setup failed: deployment (exit-1)',
  );
  expect(printed(new Error('E2E nightly results are incomplete'))).toBe(
    'E2E nightly results are incomplete',
  );
});

it('reports an existing slot lock explicitly and leaves it in place', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-slot-lock-'));
  const lock = join(directory, 'slot.lock');
  try {
    await acquireSlotLock(lock);
    const failure = await failureOf(acquireSlotLock(lock));
    expect(failure).toMatchObject({ stage: 'slot-lock', errorClass: 'EEXIST' });
    const lines = failureReport(failure);
    expect(lines[0]).toBe(
      'E2E setup failed: slot already locked (active or stale)',
    );
    expect(lines[1]).toMatch(
      new RegExp(
        `^Lock: ${lock.replaceAll('.', '\\.')} \\(created \\d{4}-\\d\\d-\\d\\dT[0-9:.]+Z\\)$`,
      ),
    );
    expect(lines[2]).toContain('docker ps');
    expect(lines[2]).toContain('e2e/README.md');
    expect((await stat(lock)).isDirectory()).toBe(true);
    await rm(lock, { recursive: true });
    await expect(
      failureOf(acquireSlotLock(join(directory, 'missing', 'slot.lock'))),
    ).resolves.toMatchObject({ stage: 'slot-lock', errorClass: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('keeps the primary failure when cleanup also fails, and still runs every cleanup', async () => {
  const primary = new SetupFailure('source-snapshot', 'ENOSPC');
  const ran: string[] = [];
  const failure = await failureOf(
    withCleanup(
      () => Promise.reject(primary),
      [
        [
          'temporary-directory',
          () => {
            ran.push('temporary-directory');
            return Promise.reject(systemError('EACCES'));
          },
        ],
        [
          'slot-lock',
          async () => {
            ran.push('slot-lock');
            await Promise.resolve();
          },
        ],
      ],
    ),
  );
  expect(ran).toEqual(['temporary-directory', 'slot-lock']);
  expect(failure).toBeInstanceOf(CleanupFailure);
  expect(failureReport(failure)).toEqual([
    'E2E setup failed: source-snapshot (ENOSPC)',
    'E2E cleanup also failed: temporary-directory (EACCES)',
  ]);

  const cleanupOnly = await failureOf(
    withCleanup(
      () => Promise.resolve('done'),
      [['slot-lock', () => Promise.reject(systemError('EBUSY'))]],
    ),
  );
  expect(failureReport(cleanupOnly)).toEqual([
    'E2E cleanup failed: slot-lock (EBUSY)',
  ]);
  await expect(withCleanup(() => Promise.resolve('done'), [])).resolves.toBe(
    'done',
  );
  await expect(withCleanup(() => Promise.reject(primary), [])).rejects.toBe(
    primary,
  );
});
