import { createHash, randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { HarnessFailure } from './diagnostics';

// A prepared local environment (#754): a stopped local Convex container,
// deployed and bound to a source, and a built workspace, kept between
// diagnostic `--reuse` runs. Its record holds no secret.

/** Reused for at most this long after it was prepared. */
export const preparedEnvironmentTtlMs = 24 * 60 * 60 * 1000;

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const instanceNameSchema = z.string().regex(/^ep-e2e-[a-f0-9-]{36}$/);
const legacyBackendSchema = z
  .object({
    image: z.string(),
    instanceName: instanceNameSchema,
    url: z.string(),
    siteUrl: z.string(),
  })
  .strict();
const preparationFields = {
  // What reuse matches on: sources without `e2e/*.spec.ts`, the effective
  // build environment, the toolchain and the installed dependencies.
  reuseFingerprint: sha256,
  parts: z
    .object({
      sources: sha256,
      buildEnvironment: sha256,
      node: z.string(),
      pnpm: z.string(),
      dependencies: sha256,
    })
    .strict(),
  // Evidence only: the full source fingerprint it was prepared from.
  sourceFingerprint: z.string(),
  target: z
    .object({
      resources: sha256,
      previewName: z.string(),
      clerkHost: z.string(),
      publishableKey: sha256,
    })
    .strict(),
  workers: z.number().int().min(1),
  releaseState: z.literal('none'),
  writeEpoch: z.number().int().nonnegative(),
  createdAt: z.number().int().positive(),
};
const preparationSchema = z
  .object({
    ...preparationFields,
    // #774: its data is a bind of a directory beside the checkout.
    backend: legacyBackendSchema.extend({
      dataPlacement: z.literal('bind-v1'),
    }),
  })
  .strict();
export type Preparation = z.infer<typeof preparationSchema>;

const recordFields = {
  state: z.enum(['in-use', 'ready']),
  // The slot-lock owner of the run holding it.
  ownerToken: z.string().min(1),
  runId: z.string().min(1),
  // The container, once one exists.
  instanceName: instanceNameSchema.nullable(),
};
// Both names of the container must agree; a record that names two is
// unreadable, never a source of a guessed container to remove.
const agreeingNames = ({
  instanceName,
  preparation,
}: {
  instanceName: string | null;
  preparation: { backend: { instanceName: string } } | null;
}) => !preparation || preparation.backend.instanceName === instanceName;
const preparedRecordSchema = z
  .object({
    schema: z.literal(2),
    ...recordFields,
    // Null until a run prepared it completely.
    preparation: preparationSchema.nullable(),
  })
  .strict()
  .refine(agreeingNames);
export type PreparedRecord = z.infer<typeof preparedRecordSchema>;
/**
 * The record every run wrote before #774, read only to dispose of its
 * container and anonymous volume; it is never reused.
 */
const legacyRecordSchema = z
  .object({
    schema: z.literal(1),
    ...recordFields,
    preparation: z
      .object({ ...preparationFields, backend: legacyBackendSchema })
      .strict()
      .nullable(),
  })
  .strict()
  .refine(agreeingNames);
type LegacyPreparedRecord = z.infer<typeof legacyRecordSchema>;

/** What the current run would prepare; a reusable preparation must match. */
export type ExpectedPreparation = Pick<
  Preparation,
  'reuseFingerprint' | 'parts' | 'target' | 'workers' | 'releaseState'
> & { image: string; dataPlacement: 'bind-v1' };

export const hashText = (text: string) =>
  createHash('sha256').update(text).digest('hex');

/**
 * Outside every checkout and run TMPDIR (and `/tmp`): next to the repo's
 * other private temporary files, keyed by the checkout and the slot.
 */
export function preparedEnvironmentDirectory({
  sourceRoot,
  previewName,
}: {
  sourceRoot: string;
  previewName: string;
}) {
  return join(
    dirname(sourceRoot),
    '.ep-tmp',
    'e2e-prepared',
    `${previewName}-${hashText(sourceRoot).slice(0, 12)}`,
  );
}

const recordPath = (directory: string) => join(directory, 'record.json');

export type PreparedRecordRead =
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | { kind: 'current'; record: PreparedRecord }
  | { kind: 'legacy'; record: LegacyPreparedRecord };

/**
 * The record: current (schema 2), legacy (schema 1, disposal only),
 * missing, or unreadable, which is kept for manual recovery.
 */
export async function readPreparedRecord(
  directory: string,
): Promise<PreparedRecordRead> {
  let text: string;
  try {
    text = await readFile(recordPath(directory), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return { kind: 'missing' };
    return { kind: 'unreadable' };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'unreadable' };
  }
  const current = preparedRecordSchema.safeParse(value);
  if (current.success) return { kind: 'current', record: current.data };
  const legacy = legacyRecordSchema.safeParse(value);
  if (legacy.success) return { kind: 'legacy', record: legacy.data };
  return { kind: 'unreadable' };
}

/** Replaces the record atomically: a reader sees the old or the new one. */
export async function writePreparedRecord(
  directory: string,
  record: PreparedRecord,
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const candidate = `${recordPath(directory)}.${randomUUID()}`;
  try {
    await writeFile(
      candidate,
      JSON.stringify(preparedRecordSchema.parse(record)),
      { mode: 0o600 },
    );
    await rename(candidate, recordPath(directory));
  } finally {
    await rm(candidate, { force: true });
  }
}

/** Where a recorded container keeps its data, which says how it is disposed of. */
export type DataPlacement = 'bind-v1' | 'volume';
/** A recorded container to dispose of, with its data. */
type Disposal = { instanceName: string; placement: DataPlacement };

export type PreparationPlan =
  | { kind: 'reuse'; preparation: Preparation }
  | {
      kind: 'prepare';
      /** A container to remove first, if any. */
      discard: Disposal | null;
      /** Why an existing environment is not reused, if there was one. */
      reason: string | null;
    }
  | { kind: 'refuse'; instanceName: string }
  | { kind: 'unreadable' };

/** The recorded container and its placement, if the record names one. */
const disposalOf = (
  read: Extract<PreparedRecordRead, { kind: 'current' | 'legacy' }>,
): Disposal | null =>
  read.record.instanceName
    ? {
        instanceName: read.record.instanceName,
        placement: read.kind === 'current' ? 'bind-v1' : 'volume',
      }
    : null;

/**
 * Whether the current run reuses the environment it found. Any recorded
 * container that is running (ready or held, current or legacy) is refused,
 * since a run may still be using it; nothing is removed automatically then.
 * A held record whose container is stopped (its run crashed, or the machine
 * restarted) is discarded, as is a legacy one (#774), which is never reused.
 * An unreadable record is kept for manual recovery.
 */
export async function planPreparation({
  record: read,
  expected,
  now,
  isRunning,
}: {
  record: PreparedRecordRead;
  /** What a --reuse run would match; null for a run that never reuses. */
  expected: ExpectedPreparation | null;
  now: number;
  isRunning: (instanceName: string) => Promise<boolean>;
}): Promise<PreparationPlan> {
  if (read.kind === 'missing')
    return { kind: 'prepare', discard: null, reason: null };
  if (read.kind === 'unreadable') return { kind: 'unreadable' };
  const discard = disposalOf(read);
  if (discard && (await isRunning(discard.instanceName)))
    return { kind: 'refuse', instanceName: discard.instanceName };
  if (read.kind === 'legacy')
    return { kind: 'prepare', discard, reason: 'data placement' };
  const { record } = read;
  if (record.state === 'in-use')
    return { kind: 'prepare', discard, reason: 'abandoned' };
  if (!expected) return { kind: 'prepare', discard, reason: null };
  const reason = findMismatch({
    preparation: record.preparation,
    expected,
    now,
  });
  return reason === null && record.preparation
    ? { kind: 'reuse', preparation: record.preparation }
    : { kind: 'prepare', discard, reason };
}

/** The first field that rules reuse out, or null. */
export function findMismatch({
  preparation,
  expected,
  now,
}: {
  preparation: Preparation | null;
  expected: ExpectedPreparation;
  now: number;
}) {
  if (!preparation) return 'incomplete';
  const { parts } = preparation;
  const checks: [string, boolean][] = [
    ['sources', parts.sources === expected.parts.sources],
    [
      'build environment',
      parts.buildEnvironment === expected.parts.buildEnvironment,
    ],
    ['node', parts.node === expected.parts.node],
    ['pnpm', parts.pnpm === expected.parts.pnpm],
    ['dependencies', parts.dependencies === expected.parts.dependencies],
    [
      'reuse fingerprint',
      preparation.reuseFingerprint === expected.reuseFingerprint,
    ],
    [
      'target',
      JSON.stringify(preparation.target) === JSON.stringify(expected.target),
    ],
    ['workers', expected.workers <= preparation.workers],
    ['release state', preparation.releaseState === expected.releaseState],
    ['backend image', preparation.backend.image === expected.image],
    [
      'data placement',
      preparation.backend.dataPlacement === expected.dataPlacement,
    ],
    [
      'age',
      now >= preparation.createdAt &&
        now - preparation.createdAt < preparedEnvironmentTtlMs,
    ],
  ];
  return checks.find(([, matches]) => !matches)?.[0] ?? null;
}

/**
 * Removes a prepared environment: its stopped container, then its data (a
 * directory beside the checkout, or a legacy record's anonymous volume),
 * then its directory with the record. A running container, or a record that
 * cannot be read (it may name a container no one can see), is refused and
 * kept for manual recovery (README); so is the record whenever its container
 * or data cannot be removed.
 */
export async function discardPreparedEnvironment({
  directory,
  isRunning,
  discardBackend,
  removeDirectory,
}: {
  directory: string;
  isRunning: (instanceName: string) => Promise<boolean>;
  discardBackend: (backend: {
    name: string;
    placement: DataPlacement;
  }) => Promise<void>;
  removeDirectory: (path: string) => Promise<void>;
}) {
  const read = await readPreparedRecord(directory);
  if (read.kind === 'unreadable')
    throw new HarnessFailure({ kind: 'prepared-unreadable' });
  const disposal = read.kind === 'missing' ? null : disposalOf(read);
  if (disposal) {
    if (await isRunning(disposal.instanceName))
      throw new HarnessFailure({ kind: 'prepared-in-use' });
    await discardBackend({
      name: disposal.instanceName,
      placement: disposal.placement,
    });
  }
  await removeDirectory(directory);
}

/**
 * Whether a workspace may be kept (#754): it holds no env or key file, and
 * none of `secrets` appears in its build output. `node_modules` is the
 * checkout's, copied, and is not searched.
 */
export async function isWorkspaceFreeOfSecrets({
  workspace,
  secrets,
}: {
  workspace: string;
  secrets: string[];
}) {
  const needles = secrets.filter(Boolean).map((secret) => Buffer.from(secret));
  const visit = async (path: string, isBuildOutput: boolean) => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        if (!(await visit(child, isBuildOutput || entry.name === '.next')))
          return false;
        continue;
      }
      if (entry.name.startsWith('.env') || entry.name.endsWith('.key'))
        return false;
      if (isBuildOutput && entry.isFile()) {
        const content = await readFile(child);
        if (needles.some((needle) => content.includes(needle))) return false;
      }
    }
    return true;
  };
  return await visit(workspace, false);
}
