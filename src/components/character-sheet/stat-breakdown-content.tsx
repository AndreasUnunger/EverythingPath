'use client';
import type { ReactNode } from 'react';
import {
  type ResolvedStatistic,
  type SourcedModifier,
  type SuppressedModifier,
} from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import {
  useBreakdownResolver,
  type BreakdownResolver,
} from './breakdown-resolver';
import { bonusTypeClasses, bonusTypeLabels } from './modifier-labels';
import { fieldLabel, formatModifier } from './sheet-parts';
import {
  describePrerequisite,
  diffSituation,
  findSuppressorName,
  listPrerequisiteContributions,
  listSituationGroups,
  type SituationGroup,
} from './stat-breakdown-groups';
import { SituationMarker } from './situation-marker';
import type { useCharacterSheet } from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
export type BreakdownTarget = keyof NonNullable<
  Controller['sheet']
>['calculated']['breakdowns'];

const contributionKey = (contribution: SourcedModifier, index: number) =>
  `${contribution.sheetEntryId}|${contribution.bonusType}|${contribution.value}|${index}`;

function TypeTag({
  contribution,
  isDim,
}: {
  contribution: SourcedModifier;
  isDim?: boolean;
}) {
  const type = contribution.bonusType;
  if (type === 'untyped' || type === 'base') return null;
  return (
    <span
      className={cn(
        'font-mono text-[11px]',
        isDim ? 'text-muted-foreground' : bonusTypeClasses[type],
      )}
    >
      {bonusTypeLabels[type]}
    </span>
  );
}

function Line({
  contribution,
  detail,
  isStruck,
  className,
}: {
  contribution: SourcedModifier;
  detail?: ReactNode;
  isStruck?: boolean;
  className?: string;
}) {
  const struck = isStruck ? 'line-through' : '';
  return (
    <li className={className}>
      <div className="flex items-baseline gap-2">
        <span className={cn('min-w-0 flex-1 truncate', struck)}>
          {contribution.entryName}
        </span>
        <TypeTag contribution={contribution} isDim={isStruck} />
        <span className={cn('font-mono', struck)}>
          {formatModifier(contribution.value)}
        </span>
      </div>
      {detail ? <div className="text-xs">{detail}</div> : null}
    </li>
  );
}

function SuppressedLines({
  items,
  statistic,
}: {
  items: SuppressedModifier[];
  statistic: ResolvedStatistic;
}) {
  return items.map((item, index) => {
    const winner = findSuppressorName(item, statistic);
    return (
      <Line
        key={contributionKey(item, index)}
        contribution={item}
        isStruck
        className="text-muted-foreground"
        detail={winner ? `${item.reason} (${winner})` : item.reason}
      />
    );
  });
}

// "Only when vs. spells": what the number becomes there, with what newly
// applies, what that sets aside, and, dimmed, what still waits on a
// prerequisite even then. A group that changes nothing shows no total.
function SituationPreview({
  group,
  statistic,
  target,
  resolver,
}: {
  group: SituationGroup;
  statistic: ResolvedStatistic;
  target: BreakdownTarget;
  resolver: BreakdownResolver;
}) {
  const inSituation = resolver.previewSituation(group.selection)?.breakdowns[
    target
  ];
  const change = inSituation
    ? diffSituation({ group, ordinary: statistic, inSituation })
    : null;
  const total = change?.total ?? null;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5 text-sky-300">
          <SituationMarker className="relative top-0 shrink-0 self-center" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{group.text}</span>
        </span>
        {total !== null ? (
          <span className="shrink-0 font-mono">
            <span className="text-muted-foreground text-xs">becomes </span>
            <span className="text-lg">{total}</span>
          </span>
        ) : null}
      </div>
      {inSituation && change ? (
        <ul className="space-y-0.5 pl-3">
          {change.applied.map((item, index) => (
            <Line key={contributionKey(item, index)} contribution={item} />
          ))}
          <SuppressedLines items={change.suppressed} statistic={inSituation} />
          {change.waiting.map((item, index) => (
            <Line
              key={contributionKey(item, index)}
              contribution={item}
              className="text-muted-foreground/70"
              detail={`${describePrerequisite(item, resolver.findPrerequisiteName)} — not now`}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Why a number is what it is: every applied contribution, built-ins
 * included; what stacking set aside and why; then "Only when…" with what the
 * number becomes in each Situation, resolved by the same rules. Nothing here
 * is summed by hand.
 */
export function BreakdownExplanation({
  statistic,
  target,
}: {
  statistic: ResolvedStatistic;
  target: BreakdownTarget;
}) {
  const resolver = useBreakdownResolver();
  const situations = listSituationGroups(statistic);
  const prerequisites = listPrerequisiteContributions(statistic);
  return (
    <>
      {statistic.applied.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nothing applies yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {statistic.applied.map((item, index) => (
            <Line key={contributionKey(item, index)} contribution={item} />
          ))}
        </ul>
      )}
      {statistic.suppressed.length > 0 ? (
        <>
          <p className={cn(fieldLabel, 'mt-2')}>Not applied</p>
          <ul className="space-y-0.5">
            <SuppressedLines
              items={statistic.suppressed}
              statistic={statistic}
            />
          </ul>
        </>
      ) : null}
      {situations.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Only when…</p>
          <ul className="space-y-2">
            {situations.map((group) => (
              <SituationPreview
                key={group.key}
                group={group}
                statistic={statistic}
                target={target}
                resolver={resolver}
              />
            ))}
          </ul>
        </div>
      ) : null}
      {prerequisites.length > 0 ? (
        <div className="border-foreground/15 mt-2 border-t pt-2">
          <p className={cn(fieldLabel, 'mb-1')}>Not now</p>
          <ul className="space-y-0.5">
            {prerequisites.map((item, index) => (
              <Line
                key={contributionKey(item, index)}
                contribution={item}
                className="text-muted-foreground"
                detail={describePrerequisite(
                  item,
                  resolver.findPrerequisiteName,
                )}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
