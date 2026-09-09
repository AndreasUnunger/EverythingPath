// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { caseAttempt, claimCaseKey } from './case-attempt';

describe('case ownership and retry lifecycle', () => {
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
