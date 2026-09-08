import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { coverageCatalog } from '../tests/rules/coverage-catalog.ts';
import {
  checkCoverage,
  renderCoverageReport,
} from '../tests/rules/check-coverage.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'coverage');
const temporary = mkdtempSync(join(tmpdir(), 'militia-rules-'));
const resultsPath = join(temporary, 'results.json');
const corpusPaths = [
  'docs/ai/ironfang-militia/militia-rules.md',
  'docs/ai/ironfang-militia/militia-tables.md',
];
const resultsSchema = z.object({
  success: z.boolean(),
  testResults: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      assertionResults: z.array(
        z.object({ fullName: z.string(), status: z.string() }),
      ),
    }),
  ),
});

try {
  if (process.argv.slice(2).some((arg) => arg !== '--strict'))
    throw new Error('Usage: pnpm rules:check [--strict]');
  mkdirSync(output, { recursive: true });
  // Always collect fresh results. A prior passing report cannot mask a failed
  // collection, interrupted run, or renamed/missing test in this checkout.
  rmSync(join(output, 'rules-report.md'), { force: true });
  const run = spawnSync(
    'pnpm',
    [
      '-s',
      'test',
      '--reporter=default',
      '--reporter=json',
      `--outputFile.json=${resultsPath}`,
    ],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  if (run.error) throw run.error;
  const results = resultsSchema.parse(
    JSON.parse(readFileSync(resultsPath, 'utf8')),
  );
  const files = Object.fromEntries(
    [
      ...new Set([
        ...corpusPaths,
        ...coverageCatalog.sources.map((source) => source.path),
      ]),
    ].map((path) => [path, readFileSync(resolve(root, path), 'utf8')]),
  );
  const audit = z
    .object({ entries: z.array(z.object({ id: z.string() })) })
    .parse(JSON.parse(files['tests/rules/audit-inventory.json']!));
  const auditIds = audit.entries.map((entry) => entry.id);
  if (
    auditIds.length !== 95 ||
    new Set(auditIds).size !== 95 ||
    auditIds.some((id) => !coverageCatalog.auditIds.includes(id)) ||
    coverageCatalog.auditIds.some((id) => !auditIds.includes(id))
  ) {
    throw new Error(
      'Catalog must retain all 95 entries from the #54 audit snapshot',
    );
  }
  const result = checkCoverage(coverageCatalog, results, files, {
    strict: process.argv.includes('--strict'),
    corpusPaths,
    requiredCases: z
      .array(z.string())
      .parse(
        JSON.parse(
          readFileSync(
            resolve(root, 'tests/rules/case-inventory.json'),
            'utf8',
          ),
        ),
      ),
  });
  if (run.status !== 0)
    result.errors.push(`Test process exited ${run.status ?? run.signal}`);
  writeFileSync(
    join(output, 'rules-report.md'),
    renderCoverageReport(coverageCatalog, result),
  );
  writeFileSync(
    join(output, 'rules-tests.json'),
    JSON.stringify(results, null, 2) + '\n',
  );
  process.stdout.write(
    `Rules coverage: ${result.covered.length} covered, ${result.gaps.length} explicit gaps, ${result.errors.length} errors. Report: coverage/rules-report.md\n`,
  );
  if (result.errors.length) {
    process.stderr.write(result.errors.join('\n') + '\n');
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
