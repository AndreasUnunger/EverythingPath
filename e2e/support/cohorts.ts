import { availableParallelism } from 'node:os';
import { resourceSchema, type Resources } from '../fixtures/catalog';

// Each concurrently running Playwright worker owns one declared cohort: a
// member organization, an outsider organization and three users. Two workers
// never share a cohort, so organization campaign lists cannot leak between
// tests. More cohorts than this may be declared; the extras stay idle.
export const defaultMaximumWorkers = 3;

/**
 * Playwright's worker count for a declaration: one per distinct cohort, capped
 * at `requested`. Without a request, it is also capped at three and at one
 * worker per available CPU. Each worker drives three browser contexts against
 * one shared production server, so on a 2-vCPU CI runner three workers
 * starve each other into journey timeouts, while two finish well inside them
 * (#198). One cohort keeps the run exactly serial. Worker N uses cohort
 * `worker-N`, matching Playwright's `parallelIndex`.
 */
export function cohortWorkers(
  resources: Resources,
  requested?: number,
  cpus = availableParallelism(),
) {
  if (!resourceSchema.safeParse(resources).success)
    throw new Error(
      'E2E worker cohorts must have distinct keys, organizations and identities',
    );
  resources.workers.forEach((worker, index) => {
    if (worker.key !== `worker-${index}`)
      throw new Error(
        'E2E worker cohorts must be declared in order as worker-0, worker-1, ...',
      );
  });
  const cohorts = resources.workers.length;
  if (requested === undefined)
    return Math.max(1, Math.min(cohorts, defaultMaximumWorkers, cpus));
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > cohorts)
    throw new Error(
      `E2E workers must be between 1 and the ${cohorts} declared cohorts`,
    );
  return requested;
}
