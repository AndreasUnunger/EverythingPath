'use client';
import type { CSSProperties, ReactNode } from 'react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { cn } from '~/lib/utils';
import { ActionLink } from './action-link';
import { FinishedWeekPane, PaneSkeleton } from './finished-week-pane';
import {
  IndexClosing,
  IndexHeading,
  IndexRows,
  IndexSkeleton,
  indexRowCount,
} from './finished-weeks-index';
import {
  indexItemClass,
  paneSlotClass,
  skeletonRowCount,
} from './finished-weeks-layout-classes';
import type { FinishedWeeksView, RecordPaneView } from './finished-weeks-types';

// The page grid; see finished-weeks-layout-classes.ts for how the index and
// the pane share it at every width.
function PageGrid({
  indexRows,
  children,
}: {
  /** Column-1 items: heading, rows or placeholders, closing lines. */
  indexRows: number;
  children: ReactNode;
}) {
  return (
    <main
      style={{ '--index-rows': indexRows } as CSSProperties}
      className="mx-auto grid w-full max-w-[90rem] flex-1 grid-cols-1 content-start md:grid-cols-[20rem_minmax(0,1fr)] md:grid-rows-[repeat(var(--index-rows),auto)_minmax(0,1fr)] xl:grid-cols-[26rem_minmax(0,1fr)]"
    >
      {children}
    </main>
  );
}

function NoWeeksPage({ action }: { action: ReactNode }) {
  return (
    <PageGrid indexRows={2}>
      <IndexHeading />
      <p
        className={cn(
          indexItemClass,
          'text-muted-foreground order-3 px-4 py-3',
        )}
      >
        No finished weeks yet.
      </p>
      <div className={paneSlotClass}>{action}</div>
    </PageGrid>
  );
}

export function FinishedWeeksLayout({
  view,
  returnHref,
  renderRecord,
}: {
  view: FinishedWeeksView;
  /** The current week's page. */
  returnHref: string;
  /** The record body (facts) for the ready pane. */
  renderRecord: (pane: RecordPaneView) => ReactNode;
}) {
  switch (view.status) {
    case 'loading':
      return (
        <PageGrid indexRows={1 + skeletonRowCount}>
          <p role="status" className="sr-only">
            Loading history…
          </p>
          <IndexHeading />
          <IndexSkeleton />
          <div className={paneSlotClass}>
            <PaneSkeleton announce={false} />
          </div>
        </PageGrid>
      );
    case 'failed':
      return (
        <PageGrid indexRows={2}>
          <IndexHeading />
          <IndexClosing inProgressWeek={null} returnHref={returnHref} />
          <div className={paneSlotClass}>
            <FailedLoadCard noun="Finished weeks" retry={view.retry} />
          </div>
        </PageGrid>
      );
    case 'empty':
      return (
        <NoWeeksPage
          action={
            <ActionLink href={view.weekHref}>
              {view.openWeek === null
                ? 'Open the current week'
                : `Open week ${view.openWeek}`}
            </ActionLink>
          }
        />
      );
    case 'no-militia':
      return (
        <NoWeeksPage
          action={<ActionLink href={view.setupHref}>Set up militia</ActionLink>}
        />
      );
    case 'ready':
      return (
        <PageGrid indexRows={2 + indexRowCount(view.index)}>
          <IndexHeading />
          <IndexRows index={view.index} />
          <div className={paneSlotClass}>
            <FinishedWeekPane pane={view.pane} renderRecord={renderRecord} />
          </div>
          <IndexClosing
            inProgressWeek={view.inProgressWeek}
            returnHref={returnHref}
          />
        </PageGrid>
      );
  }
}
