import { renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import { useLedgerCorrection } from './use-canonical-ledger';

let results: Record<string, unknown> = {};
vi.mock('@convex/_generated/api', () => ({
  api: { canonicalLedger: { read: 'read', save: 'save' } },
}));
vi.mock('convex/react', () => ({
  useQuery: (_name: string, args: { militiaId: string }) =>
    results[args.militiaId],
  useMutation: () => vi.fn(),
}));

const campaignId = 'campaign' as Id<'campaign'>;
const first = { revision: 1, state: 'first' };
const second = { revision: 1, state: 'second' };

// #141: a moment without a result must not unmount an open correction.
test('a loaded militia stays while its result is briefly missing; another militia starts loading', () => {
  results = { a: first };
  const view = renderHook(
    ({ militiaId }) =>
      useLedgerCorrection({
        campaignId,
        militiaId: militiaId as Id<'militia'>,
      }),
    { initialProps: { militiaId: 'a' } },
  );
  expect(view.result.current.ledger).toBe(first);
  results = {};
  view.rerender({ militiaId: 'a' });
  expect(view.result.current.ledger).toBe(first);
  view.rerender({ militiaId: 'b' });
  expect(view.result.current.ledger).toBeUndefined();
  results = { b: second };
  view.rerender({ militiaId: 'b' });
  expect(view.result.current.ledger).toBe(second);
});
