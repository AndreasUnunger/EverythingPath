'use client';
import type { ResolvedStatistic } from '~/lib/character-sheet';
import type { CharacterSheetBreakdownTarget } from '~/lib/character-sheet-breakdowns';
import { cn } from '~/lib/utils';
import { BreakdownContributions } from './breakdown-contributions';
import { BreakdownLine, contributionKey } from './breakdown-line';
import { BreakdownNotes } from './breakdown-notes';
import { useBreakdownResolver } from './breakdown-resolver';
import { CombatSituations } from './combat-situations';
import { SelectedSituationsSection } from './selected-situations-section';
import { fieldLabel } from './sheet-parts';
import { SituationPreview } from './situation-preview';
import {
  describeContributionScope,
  describePrerequisite,
  listPrerequisiteContributions,
} from './stat-breakdown-groups';
import { useSituationBreakdown } from './use-situation-breakdown';

/** A leaf breakdown, a derived statistic, or one class's casting number. */
export type BreakdownTarget = CharacterSheetBreakdownTarget;

/**
 * Why a number is what it is: every applied contribution, built-ins
 * included; what stacking set aside and why; its rules that change no
 * number; what the picked Situations make it; then "Only when…" with what
 * the number becomes in each Situation, the Combat situations collapsed
 * below them, what waits on another entry, and what belongs to another
 * weapon, routine or casting. Every total is the resolver's own answer.
 */
export function BreakdownExplanation({
  statistic,
  target,
  format = String,
  formatContribution,
}: {
  statistic: ResolvedStatistic;
  /** Without a sheet statistic to preview, Situations are not listed. */
  target?: BreakdownTarget;
  format?: (total: number) => string;
  formatContribution?: (value: number) => string;
}) {
  const resolver = useBreakdownResolver();
  const view = useSituationBreakdown(statistic, target);
  const waiting = view?.waiting ?? listPrerequisiteContributions(statistic);
  const excluded = view?.excluded ?? statistic.excluded ?? [];
  const notes =
    view?.notes ??
    (statistic.notes ?? []).filter(
      (note) => (note.situation ?? note.condition?.situation) === undefined,
    );
  return (
    <>
      <BreakdownContributions
        statistic={statistic}
        formatContribution={formatContribution}
      />
      {notes.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Rules</p>
          <BreakdownNotes notes={notes} className="text-xs" />
        </div>
      ) : null}
      {view ? (
        <SelectedSituationsSection
          selected={view.selected}
          format={format}
          formatContribution={formatContribution}
        />
      ) : null}
      {view && view.groups.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Only when…</p>
          <ul className="space-y-2">
            {view.groups.map((group) => (
              <SituationPreview
                key={group.key}
                group={group}
                format={format}
                formatContribution={formatContribution}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {view ? (
        <CombatSituations
          groups={view.combatGroups}
          format={format}
          formatContribution={formatContribution}
        />
      ) : null}
      {waiting.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Waiting</p>
          <ul className="space-y-0.5">
            {waiting.map((item, index) => (
              <BreakdownLine
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground"
                format={formatContribution}
                detail={describePrerequisite(
                  item,
                  resolver.findPrerequisiteName,
                  resolver.findCastingClassName,
                )}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {excluded.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Outside this scope</p>
          <ul className="space-y-0.5">
            {excluded.map((item, index) => (
              <BreakdownLine
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground"
                format={formatContribution}
                detail={
                  describeContributionScope(
                    item,
                    resolver.findCastingClassName,
                  ) ?? 'only elsewhere on the sheet'
                }
              />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
