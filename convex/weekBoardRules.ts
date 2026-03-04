import { ConvexError } from 'convex/values';

export type SettlementReputation =
  | 'Hostile'
  | 'Unfriendly'
  | 'Indifferent'
  | 'Friendly'
  | 'Helpful';

export function lowerReputationWithFloorUnfriendly(
  reputation: SettlementReputation,
) {
  if (reputation === 'Helpful') return 'Friendly' as const;
  if (reputation === 'Friendly') return 'Indifferent' as const;
  if (reputation === 'Indifferent') return 'Unfriendly' as const;
  return reputation;
}

export function getActionTeamRequirements(actionId: string) {
  const map: Record<string, string[] | null> = {
    activate_black_market: ['blackMarketeers'],
    activate_refuge: ['conspirators', 'scholars', 'spellcasters'],
    broker_market: ['blackMarketeers', 'fixers', 'merchants'],
    change_officer_role: null,
    covert_action: ['spies'],
    dismiss_team: null,
    drill_militia: null,
    earn_gold: ['blackMarketeers', 'fixers', 'merchants', 'patrons'],
    gather_information: ['conspirators', 'informants', 'scholars', 'spellcasters'],
    guarantee_event: null,
    knowledge_check: ['scholars'],
    lie_low: null,
    manipulate_events: ['guardians'],
    recruit_team: null,
    reduce_danger: ['defenders', 'guardians', 'infiltrators', 'specialists'],
    rescue_character: ['guardians', 'infiltrators', 'specialists'],
    restore_character: ['spellcasters'],
    secure_cache: ['moles', 'propagandists', 'saboteurs', 'spies'],
    special: null,
    special_order: ['fixers'],
    spread_propaganda: ['propagandists', 'saboteurs', 'spies'],
    strike_team: ['specialists'],
    upgrade_team: null,
  };
  return map[actionId] ?? null;
}

export function validateStagedActionsLegality({
  stagedActions,
  activeTeamIds,
}: {
  stagedActions: (string | null)[];
  activeTeamIds: string[];
}) {
  const staged = stagedActions.filter((value): value is string => Boolean(value));
  if (staged.length === 0) return;

  const lieLowCount = staged.filter((actionId) => actionId === 'lie_low').length;
  if (lieLowCount > 0 && staged.length > 1) {
    throw new ConvexError('Lie Low must be the only staged activity.');
  }

  const drillCount = staged.filter((actionId) => actionId === 'drill_militia').length;
  if (drillCount > 1) {
    throw new ConvexError('Drill Militia can be staged at most once per Activity phase.');
  }

  for (const actionId of staged) {
    const requiredTeamIds = getActionTeamRequirements(actionId);
    if (!requiredTeamIds || requiredTeamIds.length === 0) continue;
    const hasCapableTeam = requiredTeamIds.some((teamId) =>
      activeTeamIds.includes(teamId),
    );
    if (!hasCapableTeam) {
      throw new ConvexError(
        `Cannot stage ${actionId}: no active team can perform this action.`,
      );
    }
  }

  const actionCounts = new Map<string, number>();
  staged.forEach((actionId) => {
    actionCounts.set(actionId, (actionCounts.get(actionId) ?? 0) + 1);
  });

  for (const [actionId, count] of actionCounts) {
    const requiredTeamIds = getActionTeamRequirements(actionId);
    if (!requiredTeamIds || requiredTeamIds.length === 0) continue;
    const capableTeamCount = requiredTeamIds.filter((teamId) =>
      activeTeamIds.includes(teamId),
    ).length;
    if (count > capableTeamCount) {
      throw new ConvexError(
        `Cannot stage ${actionId} ${count} times with only ${capableTeamCount} capable active team(s).`,
      );
    }
  }
}
