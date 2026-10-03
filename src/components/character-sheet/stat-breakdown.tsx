'use client';
import { useId, type ReactNode } from 'react';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { SituationMarker } from './situation-marker';
import type { BreakdownTarget } from './stat-breakdown-content';
import { hasSituationalContributions } from './stat-breakdown-groups';
import { StatBreakdownPanel } from './stat-breakdown-panel';
import { useStatBreakdownPopup } from './use-stat-breakdown-popup';

/**
 * A sheet number that explains itself: a disclosure button named
 * "<label> <number>, breakdown" (the visible number stays in the name so a
 * voice-control user can say it) and announcing whether it is expanded,
 * controlling the labelled group it opens beneath. Tap, click, Enter or Space
 * pin the group open; a mouse resting on the number shows it too and may move
 * into it.
 */
export function StatBreakdown({
  label,
  statistic,
  target,
  incompleteReason = null,
  format = String,
  formatContribution,
  lead,
  className,
}: {
  label: string;
  statistic: ResolvedStatistic;
  /** The sheet statistic it previews in Situations; none for a summary. */
  target?: BreakdownTarget;
  /** Why the number cannot be stated yet; shown instead of a total. */
  incompleteReason?: string | null;
  /** How the total reads, in the number and in its name: "+2" for a modifier. */
  format?: (total: number) => string;
  /** How each line reads: "+2" by default, "35%" for spell failure. */
  formatContribution?: (value: number) => string;
  /** What the total stands on before its contributions, such as damage dice. */
  lead?: ReactNode;
  className?: string;
}) {
  const popup = useStatBreakdownPopup();
  const panelId = useId();
  const totalText =
    incompleteReason === null ? format(statistic.total) : 'not complete';
  const total =
    incompleteReason === null ? (
      totalText
    ) : (
      <>
        <span aria-hidden>—</span>
        <span className="sr-only">{totalText}</span>
      </>
    );
  return (
    <span
      ref={popup.wrapper}
      className="relative inline-flex"
      onPointerEnter={(event) => popup.showOnHover(event.pointerType)}
      onPointerLeave={popup.hideAfterHover}
    >
      <button
        ref={popup.trigger}
        type="button"
        aria-label={`${label} ${totalText}, breakdown`}
        aria-expanded={popup.isOpen}
        aria-controls={popup.isOpen ? panelId : undefined}
        onClick={popup.togglePinned}
        className={cn(
          'hover:bg-foreground/10 focus-visible:ring-ring/50 inline-flex min-h-8 items-center border-b border-dotted px-1 font-mono leading-none outline-none focus-visible:ring-[3px]',
          popup.isPinned
            ? 'border-primary bg-foreground/10'
            : 'border-foreground/40',
          className,
        )}
      >
        {total}
      </button>
      {hasSituationalContributions(statistic) ? (
        <SituationMarker className="-top-px -right-1" />
      ) : null}
      {popup.isOpen ? (
        <StatBreakdownPanel
          id={panelId}
          label={label}
          total={total}
          statistic={statistic}
          target={target}
          formatContribution={formatContribution}
          lead={lead}
          incompleteReason={incompleteReason}
          trigger={popup.trigger}
          onClose={popup.closeAndRefocus}
        />
      ) : null}
    </span>
  );
}
