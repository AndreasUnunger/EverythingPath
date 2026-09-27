'use client';
import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  History,
} from 'lucide-react';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import type {
  AuditEntryView,
  AuditView,
  EarlierWeeksView,
  FinishedWeeksView,
  IndexView,
  PaneView,
  RecordDate,
  RecordPaneView,
  RulesetView,
  WeekLink,
  WeekRowView,
} from './use-finished-weeks';

// Layout, as on the campaign home. One DOM order serves every width: index
// heading, index rows (with any "Earlier weeks" control in place), the pane,
// the closing lines. The `<nav>` and `<ol>` are `display: contents`, so the
// heading, every row and the pane are items of one grid on `<main>`.
//   Phone: a single column. `order` puts the pane right after the selected
//   row (rows up to it are 1, the pane 2, the rest 3), so the selected week
//   is the only expanded one; with no selected row the pane follows the
//   heading.
//   Tablet (20rem index) and desktop (26rem, page centred): the index items
//   take column 1, one row each, and the pane sits in column 2 spanning
//   every row plus a final `1fr` row that absorbs its extra height, so the
//   index rows keep their natural height. `--index-rows` counts the column-1
//   items for that template. The pane is mounted exactly once either way.
const indexItem = 'md:col-start-1';
const row =
  'block min-h-11 border-l-4 border-transparent px-4 py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset';
const currentRow = 'border-primary bg-primary/10';
const phoneDivider = 'max-md:border-b max-md:border-foreground/15';
const paneSlot =
  'md:border-foreground/15 order-2 min-w-0 p-4 md:order-none md:col-start-2 md:[grid-row:1/-1] md:border-l md:p-6';
const focusRing =
  'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const skeletonRows = 4;

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

// Phone: the page title; tablet and desktop: the small-caps column label. The
// page's h1 is the record heading "Week N".
function IndexHeading() {
  return (
    <div className={cn(indexItem, phoneDivider, 'px-4 py-2 md:py-3')}>
      <h2 className="md:text-muted-foreground text-2xl md:text-xs md:tracking-widest md:uppercase">
        Finished weeks
      </h2>
    </div>
  );
}

function RecordTime({
  date,
  className,
}: {
  date: RecordDate;
  className?: string;
}) {
  return (
    <time dateTime={date.dateTime} className={className}>
      {date.label}
    </time>
  );
}

function ReturnLink({ href }: { href: string }) {
  return (
    <GuardedLink
      href={href}
      className={cn(focusRing, 'inline-block min-h-11 py-2 text-sm underline')}
    >
      Return to current week
    </GuardedLink>
  );
}

// ---------- Index ----------

function WeekRow({ row: week }: { row: WeekRowView }) {
  return (
    <GuardedLink
      href={week.href}
      onClick={week.onNavigate}
      aria-current={week.selected ? 'page' : undefined}
      className={cn(row, 'hover:bg-foreground/5', week.selected && currentRow)}
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-semibold">Week {week.week}</span>
            <RecordTime
              date={week.date}
              className="text-muted-foreground text-xs"
            />
          </span>
          {/* Headlines wrap rather than truncate: the row is the preview. */}
          <span className="text-muted-foreground block text-sm [overflow-wrap:anywhere] md:text-xs">
            {week.headlines.join(' · ')}
          </span>
          {week.marker && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <History aria-hidden className="size-3 shrink-0" />
              {week.marker}
            </span>
          )}
        </span>
        {/* Phone: the selected row is the expanded one, its record below it. */}
        {week.selected ? (
          <ChevronUp aria-hidden className="mt-1 size-4 shrink-0 md:hidden" />
        ) : (
          <ChevronDown
            aria-hidden
            className="text-muted-foreground mt-1 size-4 shrink-0 md:hidden"
          />
        )}
      </span>
    </GuardedLink>
  );
}

// Weeks older than the row below it are not loaded; this sits in their place.
function EarlierWeeks({ item }: { item: EarlierWeeksView }) {
  if (item.status === 'failed')
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
        <span>Earlier weeks could not be loaded.</span>
        <Button type="button" variant="outline" size="sm" onClick={item.load}>
          Try again
        </Button>
      </div>
    );
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={item.status === 'loading'}
      onClick={item.load}
      className="min-h-11 w-full justify-start rounded-none px-4"
    >
      <ChevronUp aria-hidden />
      {item.status === 'loading' ? 'Loading earlier weeks…' : 'Earlier weeks'}
    </Button>
  );
}

function IndexSkeleton() {
  return Array.from({ length: skeletonRows }, (_, i) => (
    <div
      key={i}
      aria-hidden
      className={cn(indexItem, phoneDivider, 'order-3 space-y-2 px-4 py-3')}
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-48 max-w-full" />
    </div>
  ));
}

// The index rows as grid items. `selectedIndex` orders the phone column.
function IndexRows({ index }: { index: IndexView }) {
  if (index.status === 'loading') return <IndexSkeleton />;
  if (index.status === 'failed')
    return (
      <div className={cn(indexItem, phoneDivider, 'order-3 p-4')}>
        <FailedLoadCard noun="Finished weeks" retry={index.retry} />
      </div>
    );
  const selectedIndex = index.items.findIndex(
    (item) => item.kind === 'week' && item.selected,
  );
  return (
    <nav aria-label="Finished weeks" className="contents">
      <ol role="list" className="contents">
        {index.items.map((item, i) => (
          <li
            key={
              item.kind === 'week'
                ? `week-${item.week}`
                : `earlier-${item.beforeWeek}`
            }
            className={cn(
              indexItem,
              phoneDivider,
              selectedIndex >= 0 && i <= selectedIndex ? 'order-1' : 'order-3',
            )}
          >
            {item.kind === 'week' ? (
              <WeekRow row={item} />
            ) : (
              <EarlierWeeks item={item} />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function indexRowCount(index: IndexView) {
  return index.status === 'ready'
    ? index.items.length
    : index.status === 'loading'
      ? skeletonRows
      : 1;
}

// ---------- Pane ----------

// `announce` is off when the page already carries its own loading status.
function PaneSkeleton({ announce = true }: { announce?: boolean }) {
  return (
    <div className="space-y-4">
      {announce && (
        <p role="status" className="sr-only">
          Loading history…
        </p>
      )}
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div aria-hidden className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="outline" className="min-h-11 md:min-h-9">
      <GuardedLink href={href}>{children}</GuardedLink>
    </Button>
  );
}

function WeekArrow({
  link,
  label,
  icon,
}: {
  link: WeekLink;
  label: string;
  icon: ReactNode;
}) {
  if (link === null)
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled
        aria-label={label}
      >
        {icon}
      </Button>
    );
  return (
    <Button asChild variant="outline" size="icon">
      <GuardedLink href={link.href} aria-label={label}>
        {icon}
      </GuardedLink>
    </Button>
  );
}

function RulesetText({ ruleset }: { ruleset: RulesetView }) {
  switch (ruleset.status) {
    case 'ready':
      return <span>Ruleset {ruleset.version}</span>;
    case 'loading':
      return <span className="italic">Ruleset loading…</span>;
    case 'failed':
      return <span>Ruleset unavailable</span>;
  }
}

const chip = 'font-mono font-normal';

// One audit entry. A failed Ruleset gets its own retry beside the entry
// button, so no control nests inside another.
function AuditEntry({ entry }: { entry: AuditEntryView }) {
  return (
    <li className="flex items-center gap-2 pr-2">
      <button
        type="button"
        onClick={entry.select}
        aria-current={entry.selected ? 'true' : undefined}
        className={cn(
          focusRing,
          'hover:bg-foreground/5 flex min-h-11 min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-4 border-transparent px-3 py-2 text-left text-sm [overflow-wrap:anywhere] focus-visible:ring-inset',
          entry.selected && currentRow,
        )}
      >
        <span className="text-muted-foreground font-mono text-xs">
          {entry.label}
        </span>
        <span className="font-medium">{entry.provenance}</span>
        <RecordTime date={entry.date} className="text-muted-foreground" />
        <span className="text-muted-foreground">
          <RulesetText ruleset={entry.ruleset} />
        </span>
        {entry.effective && (
          <Badge variant="outline" className={chip}>
            effective
          </Badge>
        )}
        {entry.selected && !entry.effective && (
          <Badge
            variant="outline"
            className={cn(chip, 'border-amber-300/60 text-amber-300')}
          >
            showing
          </Badge>
        )}
      </button>
      {entry.ruleset.status === 'failed' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Try loading the Ruleset for ${entry.label} again`}
          onClick={entry.ruleset.retry}
        >
          Try again
        </Button>
      )}
    </li>
  );
}

function EntriesDisclosure({
  id,
  week,
  page,
}: {
  id: string;
  week: number;
  page: AuditView['page'];
}) {
  return (
    <div id={id} className="bg-card border-foreground/20 border">
      {page.status === 'loading' && (
        <p role="status" className="text-muted-foreground px-3 py-2 text-sm">
          Loading entries…
        </p>
      )}
      {page.status === 'failed' && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span>Entries could not be loaded.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={page.retry}
          >
            Try again
          </Button>
        </div>
      )}
      {page.status === 'ready' && (
        <>
          <ol
            aria-label={`Entries for week ${week}`}
            className="divide-foreground/10 divide-y"
          >
            {page.entries.map((entry) => (
              <AuditEntry key={entry.recordId} entry={entry} />
            ))}
          </ol>
          {page.earlier && (
            <div className="border-foreground/10 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={page.earlier}
                className="min-h-11 w-full justify-start rounded-none px-3"
              >
                Earlier entries
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// The record heading; scrolled into view when a different week is shown,
// including the first time a record appears. Focus is never moved.
function RecordHeading({ id, week }: { id: string; week: number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [week]);
  return (
    <h1 id={id} ref={ref} className="text-2xl font-semibold">
      Week {week}
    </h1>
  );
}

function ProvenanceLine({ p }: { p: RecordPaneView }) {
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="text-foreground">{p.provenance}</span>
      <span aria-hidden>·</span>
      <RecordTime date={p.date} />
      <span aria-hidden>·</span>
      <span>Ruleset {p.rulesetVersion}</span>
      {p.earlierEntry && (
        <Badge
          variant="outline"
          className={cn(chip, 'border-amber-300/60 text-amber-300')}
        >
          {p.earlierEntry}
        </Badge>
      )}
    </p>
  );
}

function RecordPane({
  p,
  renderRecord,
}: {
  p: RecordPaneView;
  renderRecord: (pane: RecordPaneView) => ReactNode;
}) {
  const headingId = useId();
  const entriesId = useId();
  const audit = p.audit;
  return (
    <article aria-labelledby={headingId} className="space-y-4">
      <header className="space-y-3">
        {/* Title left, controls right; on a phone the controls wrap below. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 basis-56 space-y-1">
            <RecordHeading id={headingId} week={p.week} />
            <ProvenanceLine p={p} />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {audit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={audit.open}
                aria-controls={entriesId}
                onClick={audit.toggle}
                className="min-h-9"
              >
                <History aria-hidden />
                {audit.entryCount} entries
                <ChevronDown
                  aria-hidden
                  className={cn('transition', audit.open && 'rotate-180')}
                />
              </Button>
            )}
            <WeekArrow
              link={p.previous}
              label="Previous week"
              icon={<ChevronLeft aria-hidden />}
            />
            <WeekArrow
              link={p.next}
              label="Next week"
              icon={<ChevronRight aria-hidden />}
            />
          </div>
        </div>
        {audit?.open && (
          <EntriesDisclosure id={entriesId} week={p.week} page={audit.page} />
        )}
      </header>
      {renderRecord(p)}
      <footer>
        <p className="text-muted-foreground text-xs">
          Read-only. Recorded when the week was confirmed. Corrections to a
          finished week aren&apos;t available yet.
        </p>
      </footer>
    </article>
  );
}

function Pane({
  pane,
  renderRecord,
}: {
  pane: PaneView;
  renderRecord: (pane: RecordPaneView) => ReactNode;
}) {
  switch (pane.status) {
    case 'loading':
      return <PaneSkeleton />;
    case 'failed':
      return (
        <div className="space-y-4">
          <FailedLoadCard noun="Finished weeks" retry={pane.retry} />
          {pane.effectiveHref && (
            <ActionLink href={pane.effectiveHref}>
              Show the effective record
            </ActionLink>
          )}
        </div>
      );
    case 'unavailable':
      return (
        <div className="space-y-4">
          <p>Week {pane.week} has no finished record.</p>
          <ActionLink href={pane.latestHref}>
            Show the latest finished week
          </ActionLink>
        </div>
      );
    case 'ready':
      return <RecordPane p={pane.pane} renderRecord={renderRecord} />;
  }
}

// ---------- Page ----------

// The closing lines under the index: the open week and the way back.
function IndexClosing({
  inProgressWeek,
  returnHref,
}: {
  inProgressWeek: number | null;
  returnHref: string;
}) {
  return (
    <div className={cn(indexItem, 'order-3 px-4 py-2 md:py-3')}>
      {inProgressWeek !== null && (
        <p className="text-muted-foreground text-sm">
          Week {inProgressWeek} is in progress.
        </p>
      )}
      <ReturnLink href={returnHref} />
    </div>
  );
}

function NoWeeksPage({ action }: { action: ReactNode }) {
  return (
    <PageGrid indexRows={2}>
      <IndexHeading />
      <p className={cn(indexItem, 'text-muted-foreground order-3 px-4 py-3')}>
        No finished weeks yet.
      </p>
      <div className={paneSlot}>{action}</div>
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
        <PageGrid indexRows={1 + skeletonRows}>
          <p role="status" className="sr-only">
            Loading history…
          </p>
          <IndexHeading />
          <IndexSkeleton />
          <div className={paneSlot}>
            <PaneSkeleton announce={false} />
          </div>
        </PageGrid>
      );
    case 'failed':
      return (
        <PageGrid indexRows={2}>
          <IndexHeading />
          <IndexClosing inProgressWeek={null} returnHref={returnHref} />
          <div className={paneSlot}>
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
          <div className={paneSlot}>
            <Pane pane={view.pane} renderRecord={renderRecord} />
          </div>
          <IndexClosing
            inProgressWeek={view.inProgressWeek}
            returnHref={returnHref}
          />
        </PageGrid>
      );
  }
}
