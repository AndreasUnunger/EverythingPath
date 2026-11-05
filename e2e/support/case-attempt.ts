import { randomUUID } from 'node:crypto';
import { link, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { savePrivate } from './process';

// Parallel workers may claim the same key at once. The owner is written to a
// private temporary file and linked into place: link refuses an existing
// name atomically, so exactly one test wins and no reader sees a partial file.
export async function claimCaseKey(
  privateDirectory: string,
  workerKey: string,
  caseKey: string,
  testId: string,
) {
  const path = join(
    privateDirectory,
    'case-owners',
    `${workerKey}-${caseKey}.json`,
  );
  const candidate = `${path}.${randomUUID()}.claim`;
  await savePrivate(candidate, testId);
  try {
    await link(candidate, path);
    return;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  } finally {
    await rm(candidate, { force: true });
  }
  // A retry of the owning test reclaims its key.
  if ((await readFile(path, 'utf8')) !== testId)
    throw new Error(
      'Each browser test must declare a distinct fixture case key',
    );
}

export async function caseAttempt<T>(
  reset: () => Promise<T>,
  use: (fixture: T) => Promise<void>,
  cleanup: () => Promise<void>,
  onCleanupError: () => void,
) {
  const fixture = await reset();
  try {
    await use(fixture);
  } finally {
    await cleanup().catch(onCleanupError);
  }
}
