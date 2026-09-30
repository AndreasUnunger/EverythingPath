'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvex, type ConvexReactClient } from 'convex/react';
import { ConvexError } from 'convex/values';
import {
  getFunctionName,
  makeFunctionReference,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from 'convex/server';

export type Watched<T> =
  | { status: 'loading' }
  /** `isRejected`: the server refused the request, so retrying won't help. */
  | { status: 'failed'; isRejected: boolean }
  | { status: 'ready'; data: T };

export type WatchRequest<Q extends FunctionReference<'query'>> = {
  /** Identifies the subscription; a new key is a new, separate read. */
  key: string;
  args: FunctionArgs<Q>;
};

const loading = { status: 'loading' } as const;

function failure(error: unknown) {
  return {
    status: 'failed',
    isRejected: error instanceof ConvexError,
  } as const;
}

// Generated `api` references are fresh objects on every access; the function
// name is their stable identity.
function reference<Q extends FunctionReference<'query'>>(name: string) {
  return makeFunctionReference<'query', FunctionArgs<Q>, FunctionReturnType<Q>>(
    name,
  );
}

// A result the client already holds for another subscriber, read without
// subscribing, so switching to a cached record never flashes a loading state.
function readCached<Q extends FunctionReference<'query'>>(
  convex: ConvexReactClient,
  name: string,
  args: FunctionArgs<Q>,
): Watched<FunctionReturnType<Q>> {
  try {
    const data = convex.watchQuery(reference<Q>(name), args).localQueryResult();
    return data === undefined ? loading : { status: 'ready', data };
  } catch {
    // The subscription reports the failure itself.
    return loading;
  }
}

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
      let isActive = true;
      let stop: (() => void) | undefined;
      try {
        const watch = convex.watchQuery(reference<Q>(name), args);
        const update = () => {
          if (!isActive) return;
          try {
            const data = watch.localQueryResult();
            if (data !== undefined) set(key, { status: 'ready', data });
          } catch (error) {
            set(key, failure(error));
          }
        };
        stop = watch.onUpdate(update);
        update();
      } catch (error) {
        set(key, failure(error));
      }
      live.set(key, () => {
        isActive = false;
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
        [...wanted].map(([key, args]) => [
          key,
          results[key] ?? readCached<Q>(convex, name, args),
        ]),
      ),
    [convex, name, wanted, results],
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
