'use client';
import { TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { shownRows } from './review-comparison';
import type {
  ResultCell,
  ResultRow,
  ReviewAdjustment,
  ReviewException,
  ReviewItem,
  ReviewMode,
  ReviewNote,
  ReviewSection,
  WeekReviewFacts,
} from './review-facts';

// The one renderer of the six-section week: it draws already-named facts and
// nothing else. With no capabilities it is a read-only record; the live
// Summary hands in the editing controls it wants shown at each seam. The only
// state here is the Result's "Show all values" toggle.

export type WeekReviewCapabilities = {
  /** Live only: controls shown under an exception (reason editor / removal). */
  exception?: (note: ReviewException) => ReactNode;
  /** Live only: controls shown inside a numbered adjustment. */
  adjustment?: (adjustment: ReviewAdjustment, index: number) => ReactNode;
  /** Live only: add-adjustment kind cards and form, below the list. */
  addAdjustment?: ReactNode;
};

const warningText = 'text-amber-700 dark:text-amber-300';
const wrap = 'min-w-0 [overflow-wrap:anywhere]';

function Chip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full font-mono text-xs font-normal whitespace-normal',
        className,
      )}
    >
      {children}
    </Badge>
  );
}

function Frame({
  label,
  heading,
  right,
  children,
}: {
  label: string;
  heading: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="bg-card text-card-foreground min-w-0 space-y-3 border p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h3 className={cn('text-base font-semibold', wrap)}>{heading}</h3>
        {right}
      </header>
      {children}
    </section>
  );
}

function SectionNumber({ children }: { children: ReactNode }) {
  return (
    <span className="text-muted-foreground mr-2 font-mono">{children}</span>
  );
}

function Quoted({ label, text }: { label?: string; text: string }) {
  return (
    <p className={cn('text-sm', wrap)}>
      {label && (
        <span className="text-muted-foreground mr-2 text-xs tracking-wider uppercase">
          {label}
        </span>
      )}
      “<span>{text}</span>”
    </p>
  );
}

function Warning({ message }: { message: string }) {
  return (
    <p className={cn('flex gap-2 text-sm', warningText)}>
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span className={wrap}>
        <span className="sr-only">Warning: </span>
        {message}
      </span>
    </p>
  );
}

function Exception({
  note,
  capabilities,
}: {
  note: ReviewException;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-2 border-l-2 py-1 pl-3',
        note.obsolete ? 'border-amber-500/60' : 'border-border',
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <Chip className={warningText}>{note.rule}</Chip>
        <span className="text-muted-foreground text-xs">Rules Exception</span>
      </p>
      {note.obsolete ? (
        <>
          {note.reason && <Quoted text={note.reason} />}
          <p className={cn('text-sm', warningText, wrap)}>
            This recorded exception cannot permit an extra action. Move the
            choice to an available slot, clear it, or restore the allowance.
          </p>
          {capabilities?.exception?.(note)}
        </>
      ) : capabilities?.exception ? (
        capabilities.exception(note)
      ) : note.reason ? (
        <Quoted text={note.reason} />
      ) : (
        <p className="text-muted-foreground text-sm">No reason recorded.</p>
      )}
    </div>
  );
}

function Notes({
  notes,
  capabilities,
}: {
  notes: ReviewNote[];
  capabilities?: WeekReviewCapabilities;
}) {
  if (notes.length === 0) return null;
  return (
    <ul className="min-w-0 space-y-2">
      {notes.map((note) => (
        <li key={note.key} className="min-w-0">
          {note.kind === 'warning' ? (
            <Warning message={note.message} />
          ) : note.kind === 'exception' ? (
            <Exception note={note} capabilities={capabilities} />
          ) : (
            <div className="border-border border-l-2 py-1 pl-3">
              <Quoted label="Recorded outcome" text={note.text} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Item({
  item,
  capabilities,
}: {
  item: ReviewItem;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <li className="min-w-0 space-y-2 py-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className={cn('flex-1 basis-40 text-sm', wrap)}>
          {item.title}
          {item.details.length > 0 && (
            <span className="text-muted-foreground">
              {' · '}
              {item.details.join(' · ')}
            </span>
          )}
        </p>
        {item.effects.length > 0 && (
          <ul className="flex max-w-full flex-wrap justify-end gap-1">
            {item.effects.map((effect) => (
              <li key={effect.key} className="min-w-0">
                <Chip>{effect.text}</Chip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {item.missing && (
        <p className="text-muted-foreground text-xs">
          No longer part of this week.
        </p>
      )}
      <Notes notes={item.notes} capabilities={capabilities} />
    </li>
  );
}

function PhaseSection({
  section,
  capabilities,
}: {
  section: ReviewSection;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <Frame
      label={`${section.number} ${section.title}`}
      heading={
        <>
          <SectionNumber>{section.number}</SectionNumber>
          {section.title}
        </>
      }
      right={
        section.chips.length > 0 ? (
          <ul className="flex max-w-full flex-wrap gap-1">
            {section.chips.map((chip) => (
              <li key={chip} className="min-w-0">
                <Chip>{chip}</Chip>
              </li>
            ))}
          </ul>
        ) : undefined
      }
    >
      {section.statusText && (
        <p className={cn('text-muted-foreground text-sm', wrap)}>
          {section.statusText}
        </p>
      )}
      {section.items.length > 0 && (
        <ul className="divide-border min-w-0 divide-y">
          {section.items.map((item) => (
            <Item key={item.key} item={item} capabilities={capabilities} />
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Adjustments({
  adjustments,
  mode,
  capabilities,
}: {
  adjustments: ReviewAdjustment[];
  mode: ReviewMode;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <Frame
      label="Table Adjustments"
      heading={
        <>
          <SectionNumber>5</SectionNumber>Table Adjustments
        </>
      }
      right={
        <p className="text-muted-foreground text-xs">
          Applied after the Rules Baseline, in this order.
        </p>
      }
    >
      {adjustments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No Table Adjustments. The Final{' '}
          {mode === 'live' ? 'preview' : 'outcome'} equals the Rules Baseline.
        </p>
      ) : (
        <ol className="min-w-0 space-y-2">
          {adjustments.map((adjustment, index) => (
            <li key={adjustment.key} className="min-w-0">
              <article
                aria-label={`Adjustment ${adjustment.number}`}
                className="min-w-0 space-y-2 border p-3"
              >
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground font-mono text-sm">
                    {adjustment.number}
                  </span>
                  <Chip>{adjustment.effect}</Chip>
                  <span className="text-muted-foreground text-xs">
                    {adjustment.kind}
                  </span>
                </p>
                <Quoted text={adjustment.reason} />
                <Notes notes={adjustment.notes} capabilities={capabilities} />
                {capabilities?.adjustment?.(adjustment, index)}
              </article>
            </li>
          ))}
        </ol>
      )}
      {capabilities?.addAdjustment}
    </Frame>
  );
}

function cellText(cell: ResultCell) {
  return cell.kind === 'unavailable' ? 'Not available' : cell.text;
}

function Cell({
  cell,
  emphasised,
}: {
  cell: ResultCell;
  emphasised?: boolean;
}) {
  return (
    <span
      className={cn(
        'font-mono',
        wrap,
        cell.kind !== 'value' && 'text-muted-foreground',
        emphasised && 'text-primary font-semibold',
      )}
    >
      {cellText(cell)}
    </span>
  );
}

function Result({
  result,
  mode,
}: {
  result: WeekReviewFacts['result'];
  mode: ReviewMode;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = shownRows(result.rows, showAll);
  const columns = [
    mode === 'live' ? 'Now' : 'At confirmation',
    'Rules Baseline',
    'Final',
  ] as const;
  const cells = (row: ResultRow) => [row.now, row.baseline, row.final] as const;
  return (
    <Frame
      label="Result"
      heading={
        <>
          <SectionNumber>6</SectionNumber>Result · week {result.nextWeek}{' '}
          {mode === 'live' ? 'begins' : 'began'}
        </>
      }
      right={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          Show all values
        </Button>
      }
    >
      {!result.complete && (
        <p className="text-muted-foreground text-sm">
          The Rules Baseline and Final are not available until every required
          decision is made.
        </p>
      )}
      {rows.length === 0 ? (
        result.complete && (
          <p className="text-muted-foreground text-sm">
            No values change this week.
          </p>
        )
      ) : (
        <>
          <table className="hidden w-full table-fixed text-sm md:table">
            {/* The label keeps a readable share; long recorded values wrap. */}
            <colgroup>
              <col className="w-[31%]" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead className="text-muted-foreground text-xs tracking-wider uppercase">
              <tr className="border-b">
                <th scope="col" className="py-1 text-left font-normal">
                  Value
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="py-1 pl-3 text-right font-normal"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-b-0">
                  <td className={cn('py-1.5 align-top', wrap)}>
                    <span className="text-muted-foreground text-xs">
                      {row.group} ·{' '}
                    </span>
                    {row.label}
                    {row.difference && (
                      <span className="text-muted-foreground block text-xs">
                        {row.difference}
                      </span>
                    )}
                  </td>
                  {cells(row).map((cell, index) => (
                    <td
                      key={columns[index]}
                      className="py-1.5 pl-3 text-right align-top"
                    >
                      <Cell
                        cell={cell}
                        emphasised={index === 2 && row.finalDiffers}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="min-w-0 space-y-2 md:hidden">
            {rows.map((row) => (
              <li key={row.key} className="min-w-0 border p-3 text-sm">
                <p className={wrap}>
                  <span className="text-muted-foreground text-xs">
                    {row.group} ·{' '}
                  </span>
                  {row.label}
                </p>
                <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
                  {cells(row).map((cell, index) => (
                    <div key={columns[index]} className="contents">
                      <dt className="text-muted-foreground text-xs">
                        {columns[index]}
                      </dt>
                      <dd className="min-w-0 text-right">
                        <Cell
                          cell={cell}
                          emphasised={index === 2 && row.finalDiffers}
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
                {row.difference && (
                  <p className={cn('text-muted-foreground mt-1 text-xs', wrap)}>
                    {row.difference}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Frame>
  );
}

export function WeekReviewSections({
  facts,
  capabilities,
}: {
  facts: WeekReviewFacts;
  capabilities?: WeekReviewCapabilities;
}) {
  return (
    <div className="min-w-0 space-y-4">
      {facts.sections.map((section) => (
        <PhaseSection
          key={section.phase}
          section={section}
          capabilities={capabilities}
        />
      ))}
      {facts.unassociated.length > 0 && (
        <Frame label="Unlinked facts" heading="Facts not linked to a phase">
          <Notes notes={facts.unassociated} capabilities={capabilities} />
        </Frame>
      )}
      <Adjustments
        adjustments={facts.adjustments}
        mode={facts.mode}
        capabilities={capabilities}
      />
      <Result result={facts.result} mode={facts.mode} />
    </div>
  );
}
