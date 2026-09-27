'use client';
import type { ReactNode } from 'react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import {
  OrganizationControl,
  SignIn,
} from '~/components/campaign-shell/shell-frame';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import type { HomeList } from './home-state';

function StateCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <Card className="gap-4 p-6">
        <h1 className="text-xl [overflow-wrap:anywhere]">{title}</h1>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </Card>
    </main>
  );
}

// Shaped like the ready screen: the index column with three rows and, from
// tablet width, the pane beside it; the phone shows the single column.
export function CampaignHomeSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]">
      <p role="status" className="sr-only">
        Loading campaigns…
      </p>
      <div
        aria-hidden
        className="border-foreground/15 space-y-4 px-4 py-3 md:border-r"
      >
        <Skeleton className="h-7 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div aria-hidden className="hidden space-y-4 p-6 md:block">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-prose" />
        <Skeleton className="h-5 w-2/3 max-w-prose" />
        <Skeleton className="mt-8 h-24 w-full max-w-3xl" />
      </div>
    </main>
  );
}

export function CampaignHomeStatus({
  list,
  requested,
  retry,
}: {
  list: Exclude<HomeList, { kind: 'ready' }>;
  requested: string | null;
  retry: () => void;
}) {
  switch (list.kind) {
    case 'resolving':
      return <CampaignHomeSkeleton />;
    case 'signed_out':
      return (
        <StateCard
          title={
            requested
              ? 'Sign in to open this campaign.'
              : 'Sign in to see your campaigns.'
          }
        >
          <SignIn />
        </StateCard>
      );
    case 'no_organization':
      return (
        <StateCard title="Choose an organization to see its campaigns.">
          <OrganizationControl />
        </StateCard>
      );
    case 'no_access':
      return (
        <StateCard title="You don't have access to this organization's campaigns.">
          <OrganizationControl />
        </StateCard>
      );
    case 'failed':
      return (
        <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <FailedLoadCard
            noun="Campaigns"
            hint="Please try again."
            retry={retry}
          />
        </main>
      );
  }
}
