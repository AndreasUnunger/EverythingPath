import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadRun } from './process';
import { sanitizeLog } from './artifacts';

export default class SafeReporter implements Reporter {
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
    const failed =
      result.status !== 'passed' ||
      this.results.length < 2 ||
      this.results.some((test) => test.status !== 'passed' || test.retry > 0);
    await mkdir(run.artifactDirectory, { recursive: true });
    await writeFile(
      join(run.artifactDirectory, 'report.json'),
      JSON.stringify(
        { status: failed ? 'failed' : 'passed', tests: this.results },
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
