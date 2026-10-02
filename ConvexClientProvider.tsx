'use client';

import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import type { ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  QueryClientProvider,
  QueryErrorResetBoundary,
} from '@tanstack/react-query';
import { createQueryClient } from '~/lib/convex-query-client';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const queryClient = createQueryClient(convex);
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <QueryClientProvider client={queryClient}>
        <QueryErrorResetBoundary>{children}</QueryErrorResetBoundary>
      </QueryClientProvider>
    </ConvexProviderWithClerk>
  );
}
