import type {
  FullResult,
  FullConfig,
  Suite,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { evaluateResults } from './results';
import { loadRun } from './process';
import { sanitizeLog } from './artifacts';

export default class SafeReporter implements Reporter {
  private suite?: Suite;
  private errors = 0;
  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }
  onError() {
    this.errors++;
  }
  private results: {
    journey: string;
    status: string;
    retry: number;
    duration: number;
    errors: string[];
  }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const journey = sanitizeLog(test.title)
      .replace(/[^a-zA-Z0-9 .:_-]/g, '')
      .slice(0, 160);
    const errors =
      test.parent.project()?.name === 'authentication'
        ? result.errors.map(
            () =>
              'Authentication setup failed; verify the declared cohort and Convex JWT template.',
          )
        : result.errors.map((error) =>
            sanitizeLog(error.message ?? 'Test failed').replace(
              /\u001b\[[0-9;]*m/g,
              '',
            ),
          );
    this.results.push({
      journey,
      status: result.status,
      retry: result.retry,
      duration: result.duration,
      errors,
    });
    process.stdout.write(
      `${result.status}: ${journey} (attempt ${result.retry + 1})\n`,
    );
  }
  async onEnd(result: FullResult) {
    const run = await loadRun();
    const evaluation = {
      status: result.status,
      errors: this.errors,
      tests: this.suite?.allTests().map((test) => ({
        file: basename(test.location.file),
        project: test.parent.project()?.name,
        title: test.title,
        expectedStatus: test.expectedStatus,
        tags: test.tags,
        annotations: test.annotations.map(({ type }) => type),
        results: test.results.map(({ status, retry }) => ({ status, retry })),
      })),
    };
    const failed = !evaluateResults(evaluation);
    await mkdir(run.artifactDirectory, { recursive: true });
    await writeFile(
      join(run.artifactDirectory, 'report.json'),
      JSON.stringify(
        {
          ...evaluation,
          status: failed ? 'failed' : 'passed',
          evidence: this.results,
        },
        null,
        2,
      ),
    );
    const escaped = JSON.stringify(this.results, null, 2)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    await writeFile(
      join(run.artifactDirectory, 'report.html'),
      `<!doctype html><meta charset="utf-8"><title>EverythingPath E2E</title><h1>E2E ${failed ? 'failed' : 'passed'}</h1><p>Authentication payloads and raw process output are excluded. Relevant contexts retain safe screenshots and retry action timelines.</p><pre>${escaped}</pre>`,
    );
    return { status: failed ? ('failed' as const) : ('passed' as const) };
  }
}
