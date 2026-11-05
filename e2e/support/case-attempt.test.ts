// @vitest-environment node
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
  it('lets exactly one of two simultaneous tests claim a key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'e2e-ownership-race-'));
    try {
      for (let round = 0; round < 20; round++) {
        const caseKey = `smoke-${round}`;
        const results = await Promise.allSettled(
          ['test-one', 'test-two'].map((testId) =>
            claimCaseKey(directory, 'worker-0', caseKey, testId),
          ),
        );
        const winners = results.flatMap((result, index) =>
          result.status === 'fulfilled' ? [index] : [],
        );
        expect(winners).toHaveLength(1);
        const loser = results[1 - winners[0]!];
        expect(loser).toMatchObject({
          status: 'rejected',
          reason: expect.objectContaining({
            message: expect.stringContaining('distinct fixture'),
          }),
        });
        const winner = winners[0] === 0 ? 'test-one' : 'test-two';
        await claimCaseKey(directory, 'worker-0', caseKey, winner);
      }
      expect(await readdir(join(directory, 'case-owners'))).toHaveLength(20);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
