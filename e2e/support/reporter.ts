import { createHash } from 'node:crypto';
import type {
  FullResult,
  FullConfig,
  Suite,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { evaluateResults } from './results';
import { loadRun, runSchema } from './process';
import { sanitizeLog } from './artifacts';

const safeTitle = (title: string) =>
  sanitizeLog(title)
    .replace(/[^a-zA-Z0-9 .:_-]/g, '')
    .slice(0, 160);

type StepTiming = {
  step: string;
  /** Milliseconds from the attempt's start. */
  start: number;
  /** Milliseconds, or null for a step the attempt's end interrupted. */
  duration: number | null;
  status: 'passed' | 'failed' | 'interrupted';
};

// The journey's own `test.step` phases, in order, so a slow or timed-out
// attempt shows where its time went. Only the sanitized step titles written in
// the journeys are kept: never errors, locations, parameters, hooks, fixtures
// or Playwright actions. A step still running when a timeout ends the attempt
// never finishes (Playwright reports its duration as -1): it is recorded as
// interrupted, and its start shows how long it ran.
export function stepTimings(
  result: Pick<TestResult, 'startTime' | 'steps'>,
): StepTiming[] {
  const visit = (steps: TestStep[], parents: string[]): StepTiming[] =>
    steps.flatMap((step) => {
      if (step.category !== 'test.step') return [];
      const path = [...parents, safeTitle(step.title)];
      const finished = step.duration >= 0;
      return [
        {
          step: path.join(' > '),
          start: step.startTime.getTime() - result.startTime.getTime(),
          duration: finished ? step.duration : null,
          status: !finished ? 'interrupted' : step.error ? 'failed' : 'passed',
        },
        ...visit(step.steps, path),
      ];
    });
  return visit(result.steps, []).slice(0, 100);
}

export default class SafeReporter implements Reporter {
  private suite?: Suite;
  private errors = 0;
  onBegin(_config: FullConfig, suite: Suite) {
    this.suite = suite;
  }
  onError() {
    this.errors++;
  }
  private failedSteps = new Map<string, string>();
  onTestBegin(test: TestCase) {
    this.failedSteps.delete(test.id);
  }
  onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    if (!step.error || this.failedSteps.has(test.id)) return;
    const titles = [step.title];
    let parent = step.parent;
    while (parent) {
      titles.unshift(parent.title);
      parent = parent.parent;
    }
    this.failedSteps.set(test.id, sanitizeLog(titles.join(' > ')));
  }
  private results: {
    failureIdentity: string;
    project: string;
    journey: string;
    workerKey: string | null;
    status: string;
    retry: number;
    duration: number;
    errors: string[];
    observations: string[];
    steps: StepTiming[];
  }[] = [];
  onTestEnd(test: TestCase, result: TestResult) {
    const journey = safeTitle(test.title);
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
    const runFile = process.env.E2E_RUN_FILE;
    if (!runFile) throw new Error('Missing E2E run declaration');
    const run = runSchema.parse(JSON.parse(readFileSync(runFile, 'utf8')));
    const project = test.parent.project()?.name ?? 'unknown';
    // Authentication prepares every cohort; each journey uses its worker's.
    const workerKey =
      project === 'authentication'
        ? null
        : (run.fixture?.workers[result.parallelIndex]?.key ?? null);
    this.results.push({
      failureIdentity: createHash('sha256')
        .update(this.failedSteps.get(test.id) ?? 'runner-or-fixture')
        .digest('hex')
        .slice(0, 20),
      project,
      journey,
      workerKey,
      status: result.status,
      retry: result.retry,
      duration: result.duration,
      errors,
      observations: test.annotations
        .filter(({ type }) => type === 'observation')
        .map(({ description }) =>
          sanitizeLog(description ?? 'No visible state'),
        ),
      steps: stepTimings(result),
    });
    // onTestEnd is synchronous in Playwright's reporter protocol. Checkpoint
    // before announcing completion so an outer deadline cannot erase the first
    // failed attempt. Only onEnd can produce an aggregate passing report.
    mkdirSync(run.artifactDirectory, { recursive: true });
    const checkpoint = join(run.artifactDirectory, 'progress.json');
    writeFileSync(
      `${checkpoint}.tmp`,
      JSON.stringify(
        { status: 'running', errors: this.errors, evidence: this.results },
        null,
        2,
      ),
    );
    renameSync(`${checkpoint}.tmp`, checkpoint);
    process.stdout.write(
      `${result.status}: ${project}: ${journey} (attempt ${result.retry + 1}${workerKey ? `, ${workerKey}` : ''})\n`,
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
    const failed = !evaluateResults(evaluation, run.mode);
    await mkdir(run.artifactDirectory, { recursive: true });
    await writeFile(
      join(run.artifactDirectory, 'report.json'),
      JSON.stringify(
        {
          ...evaluation,
          sourceFingerprint: run.sourceFingerprint,
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
