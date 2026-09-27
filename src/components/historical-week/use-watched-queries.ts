'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import {
  getFunctionName,
  makeFunctionReference,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from 'convex/server';

export type Watched<T> =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; data: T };

export type WatchRequest<Q extends FunctionReference<'query'>> = {
  /** Identifies the subscription; a new key is a new, separate read. */
  key: string;
  args: FunctionArgs<Q>;
};

const loading = { status: 'loading' } as const;

/**
 * A changing set of live query subscriptions, one per request key. Keys that
 * stay are never resubscribed, keys that leave are unsubscribed at once, and a
 * result is only ever returned under the key that requested it, so a late
 * result from a retired selection cannot appear under a new one.
 */
export function useWatchedQueries<Q extends FunctionReference<'query'>>(
  query: Q,
  requests: WatchRequest<Q>[],
): Record<string, Watched<FunctionReturnType<Q>>> {
  const convex = useConvex();
  // Generated `api` references are fresh objects on every access; the name is
  // the stable identity.
  const name = getFunctionName(query);
  const signature = JSON.stringify(
    requests.map(({ key, args }) => [key, args]),
  );
  const wanted = useMemo(
    () => new Map(JSON.parse(signature) as [string, FunctionArgs<Q>][]),
    [signature],
  );
  const [results, setResults] = useState<
    Record<string, Watched<FunctionReturnType<Q>>>
  >({});
  const subscriptions = useRef(new Map<string, () => void>());

  useEffect(() => {
    const live = subscriptions.current;
    const set = (key: string, value: Watched<FunctionReturnType<Q>>) =>
      setResults((previous) => ({ ...previous, [key]: value }));
    // Subscribe before unsubscribing, so a read shared with a retired key is
    // served from the client's cache instead of being fetched again.
    for (const [key, args] of wanted) {
      if (live.has(key)) continue;
      let active = true;
      let stop: (() => void) | undefined;
      try {
        const watch = convex.watchQuery(
          makeFunctionReference<
            'query',
            FunctionArgs<Q>,
            FunctionReturnType<Q>
          >(name),
          args,
        );
        const update = () => {
          if (!active) return;
          try {
            const data = watch.localQueryResult();
            if (data !== undefined) set(key, { status: 'ready', data });
          } catch {
            set(key, { status: 'failed' });
          }
        };
        stop = watch.onUpdate(update);
        update();
      } catch {
        set(key, { status: 'failed' });
      }
      live.set(key, () => {
        active = false;
        stop?.();
      });
    }
    for (const [key, stop] of live) {
      if (wanted.has(key)) continue;
      stop();
      live.delete(key);
    }
    setResults((previous) =>
      Object.keys(previous).every((key) => wanted.has(key))
        ? previous
        : Object.fromEntries(
            Object.entries(previous).filter(([key]) => wanted.has(key)),
          ),
    );
  }, [convex, name, wanted]);

  useEffect(() => {
    const live = subscriptions.current;
    return () => {
      for (const stop of live.values()) stop();
      live.clear();
    };
  }, []);

  return useMemo(
    () =>
      Object.fromEntries(
        [...wanted.keys()].map((key) => [key, results[key] ?? loading]),
      ),
    [wanted, results],
  );
}

/** One optional subscription; `null` arguments read nothing. */
export function useWatchedQuery<Q extends FunctionReference<'query'>>(
  query: Q,
  key: string,
  args: FunctionArgs<Q> | null,
): Watched<FunctionReturnType<Q>> {
  const results = useWatchedQueries(
    query,
    args === null ? [] : [{ key, args }],
  );
  return results[key] ?? loading;
}
