// @vitest-environment node
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { zipSync, strToU8 } from 'fflate';
import { expect, it } from 'vitest';
import { failureCatalog } from './nightly-history';

it.each(['new', 'open', 'closed'] as const)(
  'publishes one recurring failure using a %s issue through the GitHub boundary',
  async (state) => {
    const directory = await mkdtemp(join(tmpdir(), 'nightly-triage-'));
    const key = `${failureCatalog[1]!.key}:${'a'.repeat(20)}`;
    const summary = JSON.stringify({ failures: [key] });
    try {
      await writeFile(join(directory, 'nightly-summary.json'), summary);
      await writeFile(
        join(directory, 'history.zip'),
        zipSync({ 'nightly-summary.json': strToU8(summary) }),
      );
      await writeFile(
        join(directory, 'gh'),
        `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (args[0] === 'api') {
  const path = args.at(-1);
  if (path.includes('/workflows/')) process.stdout.write(JSON.stringify({ workflow_runs: [
    { id: 2, run_number: 2, status: 'in_progress' }, { id: 1, run_number: 1, status: 'completed' }
  ] }));
  else if (path.endsWith('/zip')) process.stdout.write(fs.readFileSync('history.zip'));
  else if (path.endsWith('/artifacts')) process.stdout.write(JSON.stringify({ artifacts: [{ id: 10, name: 'nightly-summary', expired: false }] }));
  else if (path.includes('/issues?')) process.stdout.write(JSON.stringify([[${state === 'new' ? '' : JSON.stringify({ number: 42, state, body: `<!-- nightly-failure:${key} -->` })}]]));
  else process.exit(2);
}
`,
        { mode: 0o700 },
      );
      const result = spawnSync(
        process.execPath,
        [
          resolve('node_modules/tsx/dist/cli.mjs'),
          resolve('e2e/nightly-triage.ts'),
          'publish',
        ],
        {
          cwd: directory,
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            GITHUB_REPOSITORY: 'test/repo',
            GITHUB_RUN_ID: '2',
            GH_TOKEN: '',
          },
          encoding: 'utf8',
          timeout: 15000,
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(0);
      const calls = (await readFile(join(directory, 'calls.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as string[]);
      expect(
        calls
          .filter((call) => call[0] === 'issue')
          .map((call) => call.slice(0, 2)),
      ).toEqual(
        state === 'new'
          ? [['issue', 'create']]
          : state === 'closed'
            ? [
                ['issue', 'reopen'],
                ['issue', 'edit'],
              ]
            : [['issue', 'edit']],
      );
      expect(
        await readFile(join(directory, 'nightly-issue.md'), 'utf8'),
      ).toContain('Failed in 2 of the last 2 runs');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  20000,
);
