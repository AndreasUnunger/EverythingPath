// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8');
const workflow = read('e2e-runner.yaml');

it("derives the runner's deadline from the job's budget, which each caller sets for its suite", () => {
  // The budget starts with the job, before checkout and installation.
  expect(workflow).toContain(
    'echo "E2E_DEADLINE=$(( $(date +%s) + BUDGET_SECONDS ))" >> "$GITHUB_ENV"',
  );
  expect(workflow).toContain('BUDGET_SECONDS: ${{ inputs.budget_seconds }}');
  expect(workflow).toContain('timeout-minutes: ${{ inputs.timeout_minutes }}');
  // The runner ends its run, reaps and finalizes before this interrupt.
  expect(workflow).toMatch(
    /timeout --signal=INT --kill-after=5s "\$\{remaining\}s" pnpm test:e2e --resources e2e\/resources\.ci\.json --outer-deadline-epoch "\$E2E_DEADLINE" "\$\{args\[@\]\}"/,
  );
  expect(workflow).toContain('args=(--suite "$SUITE")');
});

it.each([
  // D-17: provisional until the new mandatory suite is measured on GitHub.
  ['e2e.yaml', 'mandatory', 1050, 20],
  // D-12: the nightly full regression and compatibility projects.
  ['e2e-nightly.yaml', 'nightly', 2700, 48],
] as const)(
  '%s runs the %s suite with a %i-second budget and at least 2.5 minutes more for the job',
  (file, suite, budget, minutes) => {
    const caller = read(file);
    expect(caller).toContain(`suite: ${suite}`);
    expect(caller).toContain(`budget_seconds: ${budget}`);
    expect(caller).toContain(`timeout_minutes: ${minutes}`);
    expect(minutes * 60 - budget).toBeGreaterThanOrEqual(150);
  },
);
