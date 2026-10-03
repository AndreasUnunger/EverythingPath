import type {
  ResolveOptions,
  ResolvedStatistic,
  SourcedModifier,
  SuppressedModifier,
} from '~/lib/character-sheet';
import { describeSituation } from './modifier-labels';

// Pure grouping for a number's explanation: which contributions wait on a
// Situation (and how to ask the resolver about it), which wait on something
// else, and what a situation changes once the resolver has answered for it.

type SituationSelection = NonNullable<ResolveOptions['situations']>[number];

export type SituationGroup = {
  key: string;
  text: string;
  selection: SituationSelection;
};

const sameContribution = (a: SourcedModifier, b: SourcedModifier) =>
  a.sheetEntryId === b.sheetEntryId &&
  a.target === b.target &&
  a.bonusType === b.bonusType &&
  a.value === b.value;

export const isSituational = (contribution: SourcedModifier) =>
  contribution.condition?.situation !== undefined;

export const hasSituationalContributions = (statistic: ResolvedStatistic) =>
  statistic.conditional.some(isSituational);

/**
 * The group a situational contribution belongs to. A local situation is
 * keyed with its own adjustment so an equally named one on another
 * adjustment is a separate group that never activates it.
 */
function findSituationGroup(
  contribution: SourcedModifier,
): SituationGroup | null {
  const situation = contribution.condition?.situation;
  if (situation === undefined) return null;
  const text = describeSituation(situation);
  if (typeof situation === 'string')
    return { key: `shared:${situation}`, text, selection: situation };
  if ('local' in situation)
    return {
      key: `local:${contribution.sheetEntryId}:${situation.local}`,
      text,
      selection: {
        local: situation.local,
        sheetEntryId: contribution.sheetEntryId,
      },
    };
  return {
    key: `option:${situation.option}`,
    text,
    selection: { option: situation.option },
  };
}

/** One group per distinct Situation among the conditional contributions. */
export function listSituationGroups(
  statistic: ResolvedStatistic,
): SituationGroup[] {
  const groups = new Map<string, SituationGroup>();
  for (const contribution of statistic.conditional) {
    const group = findSituationGroup(contribution);
    if (group) groups.set(group.key, group);
  }
  return [...groups.values()];
}

/** Conditional contributions waiting on something other than a Situation. */
export function listPrerequisiteContributions(statistic: ResolvedStatistic) {
  return statistic.conditional.filter(
    (contribution) => !isSituational(contribution),
  );
}

/** "only while Rage is active": the prerequisite by name, never by identifier. */
export function describePrerequisite(
  contribution: SourcedModifier,
  findPrerequisiteName: (catalogEntryId: string) => string | null,
) {
  const prerequisite = contribution.condition?.whileActive;
  if (!prerequisite) return 'only in specific circumstances';
  const name = findPrerequisiteName(prerequisite);
  return name
    ? `only while ${name} is active`
    : 'only while its prerequisite is active';
}

/**
 * What a Situation changes, read from the resolver's answer for it: the
 * contributions it newly applies, anything it newly suppresses, and its own
 * contributions still waiting on a prerequisite there. A group whose
 * contributions all wait changes nothing, so it has no total to show.
 */
export function diffSituation({
  group,
  ordinary,
  inSituation,
}: {
  group: SituationGroup;
  ordinary: ResolvedStatistic;
  inSituation: ResolvedStatistic;
}) {
  const applied = inSituation.applied.filter(
    (contribution) =>
      !ordinary.applied.some((item) => sameContribution(item, contribution)),
  );
  const suppressed = inSituation.suppressed.filter(
    (contribution) =>
      !ordinary.suppressed.some(
        (item) =>
          sameContribution(item, contribution) &&
          item.reason === contribution.reason,
      ),
  );
  const waiting = inSituation.conditional.filter(
    (contribution) => findSituationGroup(contribution)?.key === group.key,
  );
  const hasChange = applied.length > 0 || suppressed.length > 0;
  return {
    total: hasChange ? inSituation.total : null,
    applied,
    suppressed,
    waiting,
  };
}

/** The entry a suppressed contribution lost to, by name; never an identifier. */
export function findSuppressorName(
  suppressed: SuppressedModifier,
  statistic: ResolvedStatistic,
) {
  if (suppressed.suppressedBy === suppressed.sheetEntryId) return null;
  const winner = [...statistic.applied, ...statistic.suppressed].find(
    (contribution) => contribution.sheetEntryId === suppressed.suppressedBy,
  );
  return winner?.entryName ?? null;
}
