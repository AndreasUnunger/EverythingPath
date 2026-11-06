import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  localBackendCleanupReserveMs,
  localBackendImage,
  type LocalBackend,
} from '../../scripts/local-convex/backend';
import { readLocalBackendReason } from '../../scripts/local-convex/docker';
import type { DataRoot } from '../../scripts/local-convex/data-directory';
import { HarnessFailure } from './diagnostics';
import type { Suite } from './matrix';
import type { SafeTargets } from './preflight';
import {
  discardPreparedEnvironment,
  findMismatch,
  hashText,
  planPreparation,
  preparedEnvironmentDirectory,
  type ExpectedPreparation,
  type Preparation,
  type PreparationPlan,
  type PreparedRecordRead,
} from './prepared-environment';
import type { Run } from './process';
import type { RunnerDependencies } from './runner';

// One run's use of the kept local environment (#754): which environment it
// selects, its ownership record, resuming the container, keeping it after a
// clean run, and publishing or discarding it at cleanup. The runner calls
// these at its stages; the policy stays here.

type Use = Pick<
  RunnerDependencies,
  | 'now'
  | 'sourceFingerprint'
  | 'reuseFingerprint'
  | 'readToolchain'
  | 'readPreparedRecord'
  | 'writePreparedRecord'
  | 'isLocalBackendRunning'
  | 'discardLocalBackend'
  | 'removeDirectory'
  | 'pathExists'
  | 'startLocalBackend'
  | 'readWriteEpoch'
  | 'isWorkspaceFreeOfSecrets'
  | 'prepareDataRoot'
>;

/** The run clock's fields (deadline.ts) that bound verification. */
type Clock = { deadline: number; browserStopAt: number };

// A verification read that has not answered by then will not: the
// environment is not used or kept, rather than waiting out the budget.
const verificationReadCapMs = 30_000;
const cleanupReadCapMs = 15_000;

export type PreparedSelection =
  | {
      kind: 'reused';
      backend: LocalBackend;
      /** The full source fingerprint, taken before the reuse check. */
      sourceBaseline: string;
    }
  | { kind: 'fresh' };

export function createPreparedLifecycle({
  use,
  sourceRoot,
  targets,
  workers,
  suite,
  ownerToken,
}: {
  use: Use;
  sourceRoot: string;
  targets: SafeTargets;
  workers: number;
  suite: Suite;
  /** The slot lock's owner, which the record names while this run holds it. */
  ownerToken: string;
}) {
  const directory = preparedEnvironmentDirectory({
    sourceRoot,
    previewName: targets.resources.previewName,
  });
  const workspace = join(directory, 'workspace');
  let state:
    | {
        kind: 'reused' | 'fresh';
        expected: ExpectedPreparation;
        runId: string;
        /** Complete once deployed and verified. */
        preparation?: Preparation;
      }
    | undefined;
  let isKept = false;
  // #774 fix r1: what the record names and what was planned for it, decided
  // before any leftover is recovered and before anything is claimed.
  let classified:
    | {
        plan: PreparationPlan;
        expected: ExpectedPreparation | null;
        recorded: string | null;
        record: PreparedRecordRead;
      }
    | undefined;
  // A backend this run removed is never disposed of again. Once any stop of
  // it fails (a removal, a keep, or a startup's own rollback), the outcome is
  // unknown: its record and data stay for the next run or manual recovery,
  // rather than another cleanup allowance and helper (one cleanup deadline).
  let removedInstance: string | null = null;
  let isCleanupFailed = false;
  const stopOnce = async (
    backend: LocalBackend,
    options: { keep: boolean },
  ) => {
    try {
      await backend.stop(options);
      if (!options.keep) removedInstance = backend.name;
    } catch (error) {
      isCleanupFailed = true;
      throw error;
    }
  };

  // This checkout's and slot's backend data root (#774), prepared once.
  let dataRoot: Promise<DataRoot> | undefined;
  const prepareDataRoot = () =>
    (dataRoot ??= use.prepareDataRoot({
      sourceRoot,
      previewName: targets.resources.previewName,
    }));
  /**
   * A resume failure that must not become an ordinary rejection (which
   * discards the environment): an interruption; a startup whose own rollback
   * failed, leaving its container in an unknown state (the original failure
   * stands, and nothing disposes of it); a failed stop; or a container found
   * already running (#774).
   */
  const throwIfNotRejectable = (
    error: unknown,
    isInterrupted: () => boolean,
  ) => {
    if (error instanceof HarnessFailure && error.also) isCleanupFailed = true;
    if (isInterrupted() || isCleanupFailed) throw error;
    if (readLocalBackendReason(error) === 'running')
      throw new HarnessFailure({ kind: 'prepared-in-use' });
  };
  /**
   * Recovery took time: before anything is claimed, started or removed, the
   * record still names the classified instance, and it still is not running
   * (#774). Otherwise it is left exactly as it is.
   */
  const revalidateClassification = async (
    recorded: string | null,
    record: PreparedRecordRead,
  ) => {
    const current = await use.readPreparedRecord(directory);
    if (current.kind === 'unreadable')
      throw new HarnessFailure({ kind: 'prepared-unreadable' });
    const named =
      current.kind === 'missing' ? null : current.record.instanceName;
    if (
      !isDeepStrictEqual(current, record) ||
      named !== recorded ||
      (recorded && (await use.isLocalBackendRunning(recorded)))
    )
      throw new HarnessFailure({ kind: 'prepared-in-use' });
  };
  /** The --reuse classification, still current after recovery. */
  const revalidatedForReuse = async () => {
    if (!classified?.expected)
      throw new Error('Classify the prepared environment for reuse first');
    const { plan, expected, recorded, record } = classified;
    if (plan.kind === 'refuse' || plan.kind === 'unreadable')
      throw new Error('A refused prepared environment cannot be selected');
    await revalidateClassification(recorded, record);
    return { plan, expected };
  };
  const discard = async () => {
    if (isCleanupFailed) return;
    await discardPreparedEnvironment({
      directory,
      isRunning: use.isLocalBackendRunning,
      discardBackend: async ({ name, placement }) => {
        if (name === removedInstance) return;
        await use.discardLocalBackend({
          name,
          placement,
          dataRoot: await prepareDataRoot(),
        });
      },
      removeDirectory: use.removeDirectory,
    });
  };
  const expectFor = (
    environment: Record<string, string | undefined>,
  ): ExpectedPreparation => ({
    ...use.reuseFingerprint({
      root: sourceRoot,
      environment,
      toolchain: use.readToolchain(),
    }),
    target: {
      resources: hashText(JSON.stringify(targets.resources)),
      previewName: targets.resources.previewName,
      clerkHost: targets.resources.clerkHost,
      publishableKey: hashText(targets.publishableKey),
    },
    workers,
    releaseState: 'none',
    image: localBackendImage,
    dataPlacement: 'bind-v1',
  });
  const claim = ({
    runId,
    preparation,
    instanceName = preparation?.backend.instanceName ?? null,
  }: {
    runId: string;
    preparation: Preparation | null;
    instanceName?: string | null;
  }) =>
    use.writePreparedRecord(directory, {
      schema: 2,
      state: 'in-use',
      ownerToken,
      runId,
      instanceName,
      preparation,
    });
  const verificationUntil = (until: number) =>
    Math.min(until, use.now() + verificationReadCapMs);

  /**
   * The kept container, resumed with this run's own admin key, must answer
   * as recorded, and the sources must still match after the wait: an edit
   * made meanwhile is not in the kept build. Otherwise it is removed and the
   * reason returned.
   */
  async function resume({
    preparation,
    privateDirectory,
    environment,
    clock,
    signal,
    isInterrupted,
    adoptBackend,
  }: {
    preparation: Preparation;
    privateDirectory: string;
    environment: Record<string, string | undefined>;
    clock: Clock;
    signal: AbortSignal;
    isInterrupted: () => boolean;
    adoptBackend: (backend: LocalBackend | undefined) => void;
  }) {
    let backend: LocalBackend | undefined;
    // Removed at most once; a failed removal fails the selection.
    const reject = async (reason: string) => {
      const resumed = backend;
      backend = undefined;
      adoptBackend(undefined);
      if (resumed) await stopOnce(resumed, { keep: false });
      return reason;
    };
    try {
      backend = await use.startLocalBackend({
        directory: privateDirectory,
        reuseName: preparation.backend.instanceName,
        dataRoot: await prepareDataRoot(),
        deadline: clock.browserStopAt,
        signal,
      });
      // Cleanup removes it if the run stops from here on.
      adoptBackend(backend);
      if (
        backend.url !== preparation.backend.url ||
        backend.siteUrl !== preparation.backend.siteUrl
      )
        return await reject('backend URL');
      const epoch = await use.readWriteEpoch(
        {
          backend: 'local',
          localDeployment: {
            name: backend.name,
            url: backend.url,
            adminKeyFile: backend.adminKeyFile,
          },
          suite,
          workers,
          resources: targets.resources,
          workspace,
          sourceRoot,
          privateDirectory,
          artifactDirectory: join(privateDirectory, 'resume'),
          envFile: backend.envFile,
          baseURL: 'http://127.0.0.1:1',
          preparation: 'reused',
          ...clock,
        },
        { until: verificationUntil(clock.browserStopAt) },
      );
      if (epoch !== preparation.writeEpoch) return await reject('write epoch');
      const sourceBaseline = use.sourceFingerprint(sourceRoot);
      const changed = findMismatch({
        preparation,
        expected: expectFor(environment),
        now: use.now(),
      });
      if (changed) return await reject(changed);
      return { backend, sourceBaseline };
    } catch (error) {
      throwIfNotRejectable(error, isInterrupted);
      return await reject('backend');
    }
  }

  return {
    workspace,
    get kind() {
      return state?.kind;
    },
    /**
     * This checkout's and slot's data root beside the checkout (#774),
     * prepared and verified once, under the slot lock.
     */
    dataRoot: prepareDataRoot,
    /**
     * Reads the kept environment's record and plans for it (a --reuse run
     * matches it against `environment`), refusing one whose container runs
     * or whose record cannot be read. Nothing is claimed, started or removed:
     * leftovers are recovered next, keeping the instance it returns.
     */
    async classify({
      environment,
      isReuse,
    }: {
      environment: Record<string, string | undefined>;
      isReuse: boolean;
    }) {
      const expected = isReuse ? expectFor(environment) : null;
      const record = await use.readPreparedRecord(directory);
      const plan = await planPreparation({
        record,
        expected,
        // Only a reuse match reads the run clock (the age check).
        now: expected ? use.now() : 0,
        isRunning: use.isLocalBackendRunning,
      });
      if (plan.kind === 'refuse')
        throw new HarnessFailure({ kind: 'prepared-in-use' });
      if (plan.kind === 'unreadable')
        throw new HarnessFailure({ kind: 'prepared-unreadable' });
      const recorded =
        plan.kind === 'reuse'
          ? plan.preparation.backend.instanceName
          : (plan.discard?.instanceName ?? null);
      classified = { plan, expected, recorded, record };
      return recorded;
    },
    /** Removes the kept environment, if there is one. */
    async discardIfPresent() {
      if (use.pathExists(directory)) await discard();
    },
    /**
     * Reuses the kept environment when everything matches, or prepares
     * afresh: either way this run then holds its record.
     */
    async select({
      runId,
      privateDirectory,
      environment,
      clock,
      signal,
      isInterrupted,
      adoptBackend,
    }: {
      runId: string;
      privateDirectory: string;
      /** The deploy and build environment the fingerprint covers. */
      environment: Record<string, string | undefined>;
      clock: Clock;
      signal: AbortSignal;
      isInterrupted: () => boolean;
      adoptBackend: (backend: LocalBackend | undefined) => void;
    }): Promise<PreparedSelection> {
      const { plan, expected } = await revalidatedForReuse();
      let reason = plan.kind === 'prepare' ? plan.reason : null;
      if (plan.kind === 'reuse') {
        await claim({ runId, preparation: plan.preparation });
        const resumed = await resume({
          preparation: plan.preparation,
          privateDirectory,
          environment,
          clock,
          signal,
          isInterrupted,
          adoptBackend,
        });
        if (typeof resumed !== 'string') {
          state = {
            kind: 'reused',
            expected,
            runId,
            preparation: plan.preparation,
          };
          process.stdout.write(
            'E2E prepared environment: reused (diagnostic, not qualifying).\n',
          );
          return { kind: 'reused', ...resumed };
        }
        reason = resumed;
      }
      if (use.pathExists(directory)) await discard();
      await claim({ runId, preparation: null });
      // The sources may have changed while the old one was checked.
      state = { kind: 'fresh', expected: expectFor(environment), runId };
      process.stdout.write(
        `E2E prepared environment: preparing afresh${reason ? ` (${reason} changed)` : ''}.\n`,
      );
      return { kind: 'fresh' };
    },
    /**
     * After the workspace snapshot: the sources still match what the
     * environment was, or is being, prepared from.
     */
    verifySnapshot(environment: Record<string, string | undefined>) {
      if (!state) return;
      const matched =
        state.preparation?.reuseFingerprint ?? state.expected.reuseFingerprint;
      if (expectFor(environment).reuseFingerprint !== matched)
        throw new HarnessFailure({ kind: 'source-changed' });
    },
    /** A crash from here on leaves a container the record names. */
    async recordContainer(backend: LocalBackend) {
      if (state?.kind !== 'fresh') return;
      await claim({
        runId: state.runId,
        preparation: null,
        instanceName: backend.name,
      });
    },
    /**
     * What a later --reuse run must match, once deployed. An epoch that
     * cannot be read in time leaves it incomplete, so it is not kept.
     */
    async complete({
      run,
      backend,
      sourceFingerprint,
      clock,
    }: {
      run: Run;
      backend: LocalBackend;
      sourceFingerprint: string;
      clock: Clock;
    }) {
      if (state?.kind !== 'fresh') return;
      let writeEpoch: number;
      try {
        writeEpoch = await use.readWriteEpoch(run, {
          until: verificationUntil(clock.browserStopAt),
        });
      } catch {
        process.stdout.write(
          'E2E prepared environment: not kept (its write epoch could not be read in time).\n',
        );
        return;
      }
      const { expected } = state;
      state.preparation = {
        reuseFingerprint: expected.reuseFingerprint,
        parts: expected.parts,
        sourceFingerprint,
        target: expected.target,
        workers,
        releaseState: 'none',
        backend: {
          image: expected.image,
          instanceName: backend.name,
          url: backend.url,
          siteUrl: backend.siteUrl,
          dataPlacement: expected.dataPlacement,
        },
        writeEpoch,
        createdAt: use.now(),
      };
    },
    /**
     * The `local-backend` cleanup: keeps (stops) the container only after a
     * whole, clean run that left no case behind, still sees the epoch it was
     * prepared with (read within the cleanup budget) and holds no secret in
     * its workspace; otherwise removes it.
     */
    async stopBackend({
      backend,
      run,
      isRunComplete,
    }: {
      backend: LocalBackend;
      run: Run | undefined;
      isRunComplete: boolean;
    }) {
      if (
        state?.preparation &&
        run &&
        isRunComplete &&
        (await isCleanToKeep(state.preparation, run))
      ) {
        await stopOnce(backend, { keep: true });
        isKept = true;
      } else await stopOnce(backend, { keep: false });
    },
    /**
     * The `prepared-environment` cleanup: ready only once the run's private
     * files are gone; this run's record until then; anything else discards,
     * except after a failed stop, whose record and data stay.
     */
    async release({ isPrivateRemoved }: { isPrivateRemoved: boolean }) {
      if (!state) return;
      if (isKept && isPrivateRemoved && state.preparation)
        await use.writePreparedRecord(directory, {
          schema: 2,
          state: 'ready',
          ownerToken,
          runId: state.runId,
          instanceName: state.preparation.backend.instanceName,
          preparation: state.preparation,
        });
      else await discard();
    },
    discard,
  };

  async function isCleanToKeep(preparation: Preparation, run: Run) {
    try {
      const leftovers = join(run.privateDirectory, 'leftover-cases');
      for (const cohort of await readdir(leftovers).catch(() => []))
        if ((await readdir(join(leftovers, cohort))).length > 0) return false;
      const now = use.now();
      const until = Math.min(
        (run.deadline ?? Number.POSITIVE_INFINITY) -
          localBackendCleanupReserveMs,
        now + cleanupReadCapMs,
      );
      if ((await use.readWriteEpoch(run, { until })) !== preparation.writeEpoch)
        return false;
      return await use.isWorkspaceFreeOfSecrets({
        workspace: run.workspace,
        secrets: [targets.secretKey],
      });
    } catch {
      return false;
    }
  }
}
