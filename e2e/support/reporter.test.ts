// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { resources } from './test-data';
import { evaluateResults } from './results';
import { requiredTests } from './matrix';

const workspaceTitles = requiredTests('mandatory')
  .filter(([file]) => file === 'canonical-workspace.spec.ts')
  .map(([, , title]) => title!);

// Exercise the actual reporter/Playwright protocol without browser or service
// dependencies. These synthetic bodies test result handling, not authentication.
it.each([
  'passed',
  'skipped',
  'focused',
  'quarantined',
  'retry',
  'missing-multiplayer',
  'retry-multiplayer',
  'missing-persistence',
  'retry-persistence',
  'missing-confirmation',
  'retry-confirmation',
  'missing-workspace',
  'retry-workspace',
  'missing-cutover',
  'retry-cutover',
] as const)(
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
      await writeAccessJourney(directory, playwright, mode);
      await writeFile(
        join(directory, 'existing-militia.spec.ts'),
        `import { test } from ${playwright}; test('existing militia state survives reload within its campaign', () => {});`,
      );
      await writeFile(
        join(directory, 'character-ledger.spec.ts'),
        `import { test } from ${playwright}; test('players share character and officer assignment changes', () => {});`,
      );
      await writeFile(
        join(directory, 'complete-week.spec.ts'),
        `import { test } from ${playwright}; test('a player confirms a complete week, every device moves to the next week once it is usable, and the outcome survives reload', () => {});`,
      );
      if (mode !== 'missing-multiplayer')
        await writeFile(
          join(directory, 'realtime-action-slot.spec.ts'),
          `import { test } from ${playwright}; test('players share a Staged Action Choice', async ({}, info) => { ${mode === 'retry-multiplayer' ? "if (info.retry === 0) throw new Error('Synthetic multiplayer failure');" : ''} });`,
        );
      if (mode !== 'missing-persistence')
        await writeFile(
          join(directory, 'canonical-persistence.spec.ts'),
          `import {test} from ${playwright}; test('shared persistence contract uses authenticated isolated Convex', async ({},info)=>{${mode === 'retry-persistence' ? "if(info.retry===0)throw new Error('Synthetic persistence failure');" : ''}});`,
        );
      if (mode !== 'missing-confirmation')
        await writeFile(
          join(directory, 'canonical-confirmation.spec.ts'),
          `import {test} from ${playwright}; test('shared Confirmation contract commits reviewed weeks in isolated Convex', async ({},info)=>{${mode === 'retry-confirmation' ? "if(info.retry===0)throw new Error('Synthetic Confirmation failure');" : ''}});`,
        );
      if (mode !== 'missing-workspace')
        await writeFile(
          join(directory, 'canonical-workspace.spec.ts'),
          `import { test } from ${playwright}; test.describe.configure({ mode: 'parallel' }); ${workspaceTitles
            .map(
              (title, index) =>
                `test(${JSON.stringify(title)}, async ({}, info) => { ${mode === 'retry-workspace' && index === 2 ? "if(info.retry===0) throw new Error('Synthetic Workspace failure');" : ''} });`,
            )
            .join(' ')}`,
        );
      if (mode !== 'missing-cutover')
        await writeFile(
          join(directory, 'canonical-cutover.spec.ts'),
          `import { test } from ${playwright}; test('accepted campaign preserves canonical history and rejects retired paths', async ({}, info) => { ${mode === 'retry-cutover' ? "if(info.retry===0) throw new Error('Synthetic cutover failure');" : ''} });`,
        );
      const config = join(directory, 'playwright.config.ts');
      await writeFile(
        config,
        `export default {
        testDir: ${JSON.stringify(directory)}, workers: 1, forbidOnly: true,
        retries: 1, reporter: [[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],
        projects: [
          { name: 'authentication', testMatch: 'auth.setup.ts', retries: 0 },
          { name: 'chromium-tablet', testMatch: '*.spec.ts', testIgnore: ['canonical-persistence.spec.ts','canonical-confirmation.spec.ts','canonical-workspace.spec.ts','canonical-cutover.spec.ts'], dependencies: ['authentication'] },
          { name: 'canonical-persistence', testMatch: 'canonical-persistence.spec.ts', dependencies: ['authentication'] },
          { name: 'canonical-confirmation', testMatch: 'canonical-confirmation.spec.ts', dependencies: ['authentication'] },
          { name: 'canonical-workspace', testMatch: 'canonical-workspace.spec.ts', dependencies: ['authentication'] },
          { name: 'canonical-cutover', testMatch: 'canonical-cutover.spec.ts', dependencies: ['authentication'] },
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
      if (
        mode === 'retry' ||
        mode === 'retry-multiplayer' ||
        mode === 'retry-persistence' ||
        mode === 'retry-confirmation' ||
        mode === 'retry-workspace' ||
        mode === 'retry-cutover'
      )
        expect(report).toMatchObject({
          tests: expect.arrayContaining([
            expect.objectContaining({
              file:
                mode === 'retry'
                  ? 'access.spec.ts'
                  : mode === 'retry-multiplayer'
                    ? 'realtime-action-slot.spec.ts'
                    : mode === 'retry-persistence'
                      ? 'canonical-persistence.spec.ts'
                      : mode === 'retry-confirmation'
                        ? 'canonical-confirmation.spec.ts'
                        : mode === 'retry-workspace'
                          ? 'canonical-workspace.spec.ts'
                          : 'canonical-cutover.spec.ts',
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

async function writeAccessJourney(
  directory: string,
  playwright: string,
  mode: string,
) {
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
}

it('keeps safe completed-attempt evidence when the runner is killed before onEnd', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'e2e-interrupted-reporter-'));
  const artifactDirectory = join(directory, 'artifacts');
  const runFile = join(directory, 'run.json');
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
    const playwright = JSON.stringify(
      resolve('node_modules/@playwright/test/index.mjs'),
    );
    await writeFile(
      join(directory, 'interrupted.spec.ts'),
      `import {test} from ${playwright}; test('completed service timeout',async()=>{test.setTimeout(50);await new Promise(()=>{});}); test('later work',async()=>{await new Promise(()=>{});});`,
    );
    const config = join(directory, 'playwright.config.ts');
    await writeFile(
      config,
      `export default {testDir:${JSON.stringify(directory)},workers:1,retries:0,reporter:[[${JSON.stringify(resolve('e2e/support/reporter.ts'))}]],projects:[{name:'canonical-persistence',testMatch:'interrupted.spec.ts'}]};`,
    );
    await new Promise<void>((resolveDone, reject) => {
      const child = spawn(
        process.execPath,
        [
          resolve('node_modules/@playwright/test/cli.js'),
          'test',
          '--config',
          config,
        ],
        {
          env: { ...process.env, E2E_RUN_FILE: runFile },
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32',
        },
      );
      let observed = false;
      let output = '';
      const kill = () => {
        if (child.pid && process.platform !== 'win32')
          process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      };
      const deadline = setTimeout(kill, 8000);
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
        if (
          !observed &&
          output.includes(
            'timedOut: canonical-persistence: completed service timeout',
          )
        ) {
          observed = true;
          kill();
        }
      });
      child.on('error', reject);
      child.on('close', () => {
        clearTimeout(deadline);
        if (observed) resolveDone();
        else reject(new Error('Completed timeout was not reported'));
      });
    });
    const checkpoint = JSON.parse(
      await readFile(join(artifactDirectory, 'progress.json'), 'utf8'),
    ) as unknown;
    expect(checkpoint).toMatchObject({
      status: 'running',
      evidence: [
        {
          project: 'canonical-persistence',
          status: 'timedOut',
          retry: 0,
          errors: [expect.stringContaining('50ms')],
        },
      ],
    });
    expect(evaluateResults(checkpoint, 'mandatory')).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 10000);
