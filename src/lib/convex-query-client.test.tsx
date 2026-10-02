import { act, renderHook, waitFor } from '@testing-library/react';
import { convexQuery } from '@convex-dev/react-query';
import { useQuery } from '@tanstack/react-query';
import { makeFunctionReference } from 'convex/server';
import { StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { queryCacheFixture } from '../../tests/convex-query-cache';

const query = makeFunctionReference<'query', { id: string }, string>(
  'example:read',
);
const values = new Map<string, string | null | Error>();
let cache: ReturnType<typeof queryCacheFixture>;
beforeEach(() => {
  values.clear();
  cache = queryCacheFixture((_name, args) => {
    const value = values.get(String(args.id));
    if (value instanceof Error) throw value;
    return value;
  });
});
afterEach(() => {
  cache.client.clear();
  vi.useRealTimers();
});

test('multiple readers share a live subscription and reopening sees updates received while unmounted', async () => {
  values.set('first', 'Original');
  const useRead = () => useQuery(convexQuery(query, { id: 'first' }));
  const first = renderHook(useRead, { wrapper: cache.wrapper });
  const second = renderHook(useRead, { wrapper: cache.wrapper });
  await waitFor(() => expect(second.result.current.data).toBe('Original'));
  expect(cache.opened).toHaveLength(1);
  first.unmount();
  second.unmount();
  values.set('first', 'Updated while away');
  act(() => cache.push());
  const returning = renderHook(useRead, { wrapper: cache.wrapper });
  expect(returning.result.current.data).toBe('Updated while away');
  expect(returning.result.current.isPending).toBe(false);
  expect(cache.opened).toHaveLength(1);
  expect(cache.reads).toHaveLength(1);
});

test('idle subscriptions expire after one minute and an expired selection starts loading again', async () => {
  values.set('first', 'Original');
  const useRead = () => useQuery(convexQuery(query, { id: 'first' }));
  const view = renderHook(useRead, { wrapper: cache.wrapper });
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  vi.useFakeTimers();
  view.unmount();
  act(() => {
    vi.advanceTimersByTime(59_999);
  });
  expect(cache.live.size).toBe(1);
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(cache.live.size).toBe(0);
  vi.useRealTimers();
  values.delete('first');
  const returning = renderHook(useRead, { wrapper: cache.wrapper });
  expect(returning.result.current.isPending).toBe(true);
  expect(returning.result.current.data).toBeUndefined();
  values.set('first', 'Current');
  act(() => cache.push());
  await waitFor(() => expect(returning.result.current.data).toBe('Current'));
  expect(cache.opened).toHaveLength(2);
});

test('a late callback during selection cleanup only updates its own cached query', async () => {
  values.set('first', 'Original');
  const view = renderHook(
    ({ id }) => {
      const result = useQuery(convexQuery(query, { id }));
      useLayoutEffect(() => {
        if (id === 'second') {
          values.set('first', 'Late old selection');
          cache.opened[0]!.update();
        }
      }, [id]);
      return result;
    },
    { initialProps: { id: 'first' }, wrapper: cache.wrapper },
  );
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  view.rerender({ id: 'second' });
  expect(view.result.current.isPending).toBe(true);
  expect(view.result.current.data).toBeUndefined();
  values.set('second', 'New selection');
  act(() => cache.push());
  await waitFor(() => expect(view.result.current.data).toBe('New selection'));
  view.rerender({ id: 'first' });
  expect(view.result.current.data).toBe('Late old selection');
});

test('query errors remain local and explicit retry reuses the subscription', async () => {
  values.set('first', new Error('unavailable'));
  const { result } = renderHook(
    () => useQuery(convexQuery(query, { id: 'first' })),
    { wrapper: cache.wrapper },
  );
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(cache.reads).toHaveLength(1);
  values.set('first', 'Recovered');
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toBe('Recovered'));
  expect(cache.opened).toHaveLength(1);
});

test.each(['Recovered', null])(
  'an initial query error recovers from a live update containing %s',
  async (recovered) => {
    values.set('first', new Error('unavailable'));
    const { result } = renderHook(
      () => useQuery(convexQuery(query, { id: 'first' })),
      { wrapper: cache.wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    values.set('first', recovered);
    act(() => cache.push());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(recovered);
    expect(cache.reads).toHaveLength(1);
    expect(cache.opened).toHaveLength(1);
  },
);

test('Strict Mode shares one subscription through its effect restart', async () => {
  values.set('first', 'Original');
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <cache.wrapper>{children}</cache.wrapper>
      </StrictMode>
    );
  }
  const view = renderHook(() => useQuery(convexQuery(query, { id: 'first' })), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(view.result.current.data).toBe('Original'));
  expect(cache.opened).toHaveLength(1);
  view.unmount();
  cache.client.clear();
  expect(cache.live.size).toBe(0);
});
