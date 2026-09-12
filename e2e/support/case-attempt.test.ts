// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { caseAttempt, claimCaseKey } from './case-attempt';
import { browserProjects } from './matrix';

describe('case ownership and retry lifecycle', () => {
  it('gives editing and Confirmation separate ownership for their declared cases', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-contract-ownership-'));
    try {
      for (const file of [
        'canonical-persistence.spec.ts',
        'canonical-confirmation.spec.ts',
      ]) {
        const project = browserProjects('mandatory').find((candidate) =>
          [candidate.testMatch].flat().includes(file),
        );
        expect(project?.name).toBeDefined();
        for (const caseKey of ['canonicalPersistence', 'isolation']) {
          await claimCaseKey(
            directory,
            `${project?.name}-worker-0`,
            caseKey,
            file,
          );
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it('resets before contexts on both the initial attempt and retry, even when cleanup fails', async () => {
    const order: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      await caseAttempt(
        async () => {
          order.push('reset');
        },
        async () => {
          order.push('contexts');
        },
        async () => {
          order.push('cleanup');
          throw new Error('offline');
        },
        () => {
          order.push('cleanup warning');
        },
      );
    }
    expect(order).toEqual([
      'reset',
      'contexts',
      'cleanup',
      'cleanup warning',
      'reset',
      'contexts',
      'cleanup',
      'cleanup warning',
    ]);
  });
  it('never creates contexts after a failed reset', async () => {
    const contexts = vi.fn();
    await expect(
      caseAttempt(
        async () => {
          throw new Error('refused');
        },
        contexts,
        vi.fn(),
        vi.fn(),
      ),
    ).rejects.toThrow('refused');
    expect(contexts).not.toHaveBeenCalled();
  });
  it('allows a retry to reclaim its key and refuses sharing between tests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-ownership-test-'));
    try {
      await claimCaseKey(directory, 'worker-0', 'smoke', 'test-one');
      await claimCaseKey(directory, 'worker-0', 'smoke', 'test-one');
      await expect(
        claimCaseKey(directory, 'worker-0', 'smoke', 'test-two'),
      ).rejects.toThrow('distinct fixture');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
