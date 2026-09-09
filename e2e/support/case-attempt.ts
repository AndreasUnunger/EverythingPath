import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { savePrivate } from './process';

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
  let owner: string | undefined;
  try {
    owner = await readFile(path, 'utf8');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  if (owner && owner !== testId)
    throw new Error(
      'Each browser test must declare a distinct fixture case key',
    );
  await savePrivate(path, testId);
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
