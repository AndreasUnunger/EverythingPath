'use client';

import { ConvexQueryCacheProvider } from 'convex-helpers/react/cache';
import type { ReactNode } from 'react';

export default function ConvexQueryCacheProviderClientComponent({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexQueryCacheProvider>{children}</ConvexQueryCacheProvider>;
}
