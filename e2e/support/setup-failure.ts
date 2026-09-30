import { mkdir, stat } from 'node:fs/promises';
import { z } from 'zod';
import { CommandEvidenceFailure, CommandFailure } from './process';

// Every runner step before the browser journeys, in order. A failure reports
// only one of these fixed labels and a class from the closed set below; the
// original message, name, stack, cause and provider output are never printed.
export const setupStages = [
  'arguments',
  'resources',
  'workers',
  'clerk-verification',
  'private-directory',
  'slot-lock',
  'temporary-directory',
  'source-snapshot',
  'environment',
  'port',
  'run-file',
  // The deployment command's run-file read and first stages.log write.
  'evidence',
  // Preview recreation, deploy, fixture binding and web build (stages.log).
  'deployment',
  'generated-bindings',
  'preview-binding',
  'artifact-directory',
] as const;
export type SetupStage = (typeof setupStages)[number];
export const cleanupTargets = ['temporary-directory', 'slot-lock'] as const;
export type CleanupTarget = (typeof cleanupTargets)[number];

export const systemErrorClasses = [
  'ENOENT',
  'EACCES',
  'EPERM',
  'EEXIST',
  'ENOTDIR',
  'EISDIR',
  'ENOTEMPTY',
  'ENOSPC',
  'EROFS',
  'EMFILE',
  'EBUSY',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EADDRINUSE',
  'EADDRNOTAVAIL',
] as const;
type SystemErrorClass = (typeof systemErrorClasses)[number];
export type ErrorClass =
  | SystemErrorClass
  | `exit-${number}`
  | 'terminated'
  | 'timeout'
  | 'validation'
  | 'unknown';

export function isErrorClass(value: string): value is ErrorClass {
  return (
    (systemErrorClasses as readonly string[]).includes(value) ||
    /^exit-(?:[1-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])$/.test(value) ||
    ['terminated', 'timeout', 'validation', 'unknown'].includes(value)
  );
}

// Messages the harness itself composes from fixed text; printed as before.
const ownDiagnosticPattern =
  /^(E2E |Clerk |Convex generated|This harness|Secrets file|Usage:|preview deployment|Chromium tablet|Preview callback)/;
export function ownDiagnostic(error: unknown) {
  return error instanceof Error && ownDiagnosticPattern.test(error.message)
    ? error.message
    : undefined;
}

// Fetch (undici) reports socket failures with its own codes.
const undiciClasses: Record<string, SystemErrorClass> = {
  UND_ERR_CONNECT_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_HEADERS_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_BODY_TIMEOUT: 'ETIMEDOUT',
  UND_ERR_SOCKET: 'ECONNRESET',
};
function systemClass(error: unknown): SystemErrorClass | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return undefined;
  const { code } = error;
  if (typeof code !== 'string') return undefined;
  return (
    systemErrorClasses.find((known) => known === code) ??
    (Object.hasOwn(undiciClasses, code) ? undiciClasses[code] : undefined)
  );
}
function exitClass(status: unknown): ErrorClass | undefined {
  return typeof status === 'number' &&
    Number.isInteger(status) &&
    status >= 1 &&
    status <= 255
    ? `exit-${status}`
    : undefined;
}

// Reads only known, typed fields and compares them against the closed set.
export function classifyError(error: unknown): ErrorClass {
  if (error instanceof CommandEvidenceFailure)
    return classifyError(error.cause);
  const system = systemClass(error);
  if (system) return system;
  if (error instanceof CommandFailure)
    return error.exitCode === null
      ? 'terminated'
      : (exitClass(error.exitCode) ?? 'unknown');
  if (typeof error !== 'object' || error === null) return 'unknown';
  // execFileSync (git) failures carry the child's status or signal.
  const { status, signal } = error as { status?: unknown; signal?: unknown };
  const exited = exitClass(status);
  if (exited) return exited;
  if (status === null && typeof signal === 'string') return 'terminated';
  if (!(error instanceof Error)) return 'unknown';
  // AbortSignal.timeout rejects fetch with a TimeoutError DOMException.
  if (error.name === 'TimeoutError') return 'timeout';
  if (error.message.startsWith('E2E execution exceeded')) return 'timeout';
  // fetch rejects with a TypeError whose cause is the socket error.
  const cause = systemClass(error.cause);
  if (cause) return cause;
  const code = (error as { code?: unknown }).code;
  if (
    error instanceof z.ZodError ||
    error instanceof SyntaxError ||
    (typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_')) ||
    ownDiagnostic(error)
  )
    return 'validation';
  return 'unknown';
}

type SlotLock = { path: string; createdAt?: string };
export class SetupFailure extends Error {
  constructor(
    readonly stage: SetupStage,
    readonly errorClass: ErrorClass,
    // Only a message matching the harness's own fixed diagnostics.
    readonly diagnostic?: string,
    readonly lock?: SlotLock,
  ) {
    super(`E2E setup failed: ${stage} (${errorClass})`);
    this.name = 'SetupFailure';
  }
}

export function setupFailure(stage: SetupStage, error: unknown) {
  if (error instanceof SetupFailure) return error;
  return new SetupFailure(
    error instanceof CommandEvidenceFailure ? 'evidence' : stage,
    classifyError(error),
    ownDiagnostic(error),
  );
}

export async function setupStage<T>(
  stage: SetupStage,
  step: () => T | Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (error) {
    throw setupFailure(stage, error);
  }
}

async function lockCreatedAt(path: string) {
  try {
    const lock = await stat(path);
    return (lock.birthtimeMs > 0 ? lock.birthtime : lock.mtime).toISOString();
  } catch {
    return undefined;
  }
}

// An existing lock is never removed here: it may belong to a running gate.
export async function acquireSlotLock(path: string) {
  try {
    await mkdir(path);
  } catch (error) {
    const failure = setupFailure('slot-lock', error);
    if (failure.errorClass !== 'EEXIST') throw failure;
    throw new SetupFailure('slot-lock', 'EEXIST', undefined, {
      path,
      createdAt: await lockCreatedAt(path),
    });
  }
}

export class CleanupFailure extends Error {
  constructor(
    readonly target: CleanupTarget,
    readonly errorClass: ErrorClass,
    // The run's own failure, which cleanup must not replace.
    readonly primary?: { error: unknown },
  ) {
    super(
      `E2E cleanup ${primary ? 'also ' : ''}failed: ${target} (${errorClass})`,
    );
    this.name = 'CleanupFailure';
  }
}

// Runs every cleanup even after one fails; the body's failure stays primary.
export async function withCleanup<T>(
  body: () => Promise<T>,
  cleanups: readonly (readonly [CleanupTarget, () => Promise<unknown>])[],
): Promise<T> {
  let outcome: { value: T } | { error: unknown };
  try {
    outcome = { value: await body() };
  } catch (error) {
    outcome = { error };
  }
  let cleanupFailure: CleanupFailure | undefined;
  for (const [target, clean] of cleanups) {
    try {
      await clean();
    } catch (error) {
      cleanupFailure ??= new CleanupFailure(
        target,
        classifyError(error),
        'error' in outcome ? { error: outcome.error } : undefined,
      );
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

export const slotLockGuidance =
  'Not removed automatically. Check `docker ps` (and local `pnpm test:e2e` processes) for a running gate before removing it; see "Setup failures" in e2e/README.md.';

// The only text the runner prints for a failure.
export function failureReport(error: unknown): string[] {
  if (error instanceof CleanupFailure)
    return error.primary
      ? [...failureReport(error.primary.error), error.message]
      : [error.message];
  if (error instanceof SetupFailure) {
    if (error.stage === 'slot-lock' && error.errorClass === 'EEXIST')
      return [
        'E2E setup failed: slot already locked (active or stale)',
        `Lock: ${error.lock?.path ?? 'unknown path'}${error.lock?.createdAt ? ` (created ${error.lock.createdAt})` : ''}`,
        slotLockGuidance,
      ];
    return error.diagnostic
      ? [error.diagnostic, error.message]
      : [error.message];
  }
  return [
    ownDiagnostic(error) ??
      'E2E failed after setup; inspect the safe evidence directory.',
  ];
}
