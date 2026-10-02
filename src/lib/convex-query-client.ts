import { ConvexQueryClient } from '@convex-dev/react-query';
import { QueryClient } from '@tanstack/react-query';
import type { ConvexReactClient } from 'convex/react';

export function createQueryClient(convex: ConvexReactClient) {
  const adapter = new ConvexQueryClient(convex);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: adapter.hashFn(),
        queryFn: adapter.queryFn(),
        // Keep live results through short trips between campaign screens.
        gcTime: 60_000,
        // Convex retries connection failures. Query errors are surfaced to
        // the caller, which can offer an explicit retry when appropriate.
        retry: false,
      },
    },
  });
  adapter.connect(client);
  return client;
}
