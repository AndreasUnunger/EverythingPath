import { getMaxTeamsForRank } from '../src/lib/militia-progression-rules';
import { isUpgradePathAllowed } from '../src/lib/rules-teams';
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
    gather_information: [
      'conspirators',
      'informants',
      'scholars',
      'spellcasters',
    ],
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

export { getTeamCost, isUpgradePathAllowed } from '../src/lib/rules-teams';
export { getMaxTeamsForRank } from '../src/lib/militia-progression-rules';

export function buildTeamOperationWarnings({
  rank,
  rosterTeamIds,
  recruits,
  dismissals,
  upgrades,
}: {
  rank: number;
  rosterTeamIds: string[];
  recruits: Array<{ slotIndex: number; teamId: string }>;
  dismissals: Array<{ slotIndex: number; teamId: string }>;
  upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
}) {
  const warnings: Array<{ code: string; message: string }> = [];
  const maxTeams = getMaxTeamsForRank(rank);
  const working = new Set(rosterTeamIds);

  for (const dismiss of dismissals) {
    if (!working.has(dismiss.teamId)) {
      warnings.push({
        code: 'dismiss_team_not_found',
        message: `Dismiss references team not in roster: ${dismiss.teamId}.`,
      });
      continue;
    }
    working.delete(dismiss.teamId);
  }

  for (const recruit of recruits) {
    if (working.has(recruit.teamId)) {
      warnings.push({
        code: 'recruit_team_duplicate',
        message: `Recruit references team already in roster: ${recruit.teamId}.`,
      });
      continue;
    }
    if (working.size >= maxTeams) {
      warnings.push({
        code: 'team_cap_exceeded',
        message: `Recruiting ${recruit.teamId} exceeds max team cap (${maxTeams}) at rank ${rank}.`,
      });
    }
    working.add(recruit.teamId);
  }

  for (const upgrade of upgrades) {
    if (!working.has(upgrade.fromTeamId)) {
      warnings.push({
        code: 'upgrade_from_missing',
        message: `Upgrade source team is not in roster: ${upgrade.fromTeamId}.`,
      });
    }
    if (!isUpgradePathAllowed(upgrade.fromTeamId, upgrade.toTeamId)) {
      warnings.push({
        code: 'upgrade_path_invalid',
        message: `Upgrade path is not valid: ${upgrade.fromTeamId} -> ${upgrade.toTeamId}.`,
      });
    }
  }

  return warnings;
}

export function validateStagedActionsLegality({
  stagedActions,
  activeTeamIds,
}: {
  stagedActions: (string | null)[];
  activeTeamIds: string[];
}): Array<{ code: string; message: string }> {
  const staged = stagedActions.filter((value): value is string =>
    Boolean(value),
  );
  const warnings: Array<{ code: string; message: string }> = [];
  if (staged.length === 0) return warnings;

  const lieLowCount = staged.filter(
    (actionId) => actionId === 'lie_low',
  ).length;
  if (lieLowCount > 0 && staged.length > 1) {
    throw new ConvexError('Lie Low must be the only staged activity.');
  }

  const drillCount = staged.filter(
    (actionId) => actionId === 'drill_militia',
  ).length;
  if (drillCount > 1) {
    throw new ConvexError(
      'Drill Militia can be staged at most once per Activity phase.',
    );
  }

  for (const actionId of staged) {
    const requiredTeamIds = getActionTeamRequirements(actionId);
    if (!requiredTeamIds || requiredTeamIds.length === 0) continue;
    const hasCapableTeam = requiredTeamIds.some((teamId) =>
      activeTeamIds.includes(teamId),
    );
    if (!hasCapableTeam) {
      warnings.push({
        code: 'action_requires_missing_team',
        message: `Staged ${actionId} but no active team can perform this action.`,
      });
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
      warnings.push({
        code: 'action_capable_team_count_exceeded',
        message: `Staged ${actionId} ${count} time(s) with only ${capableTeamCount} capable active team(s).`,
      });
    }
  }

  return warnings;
}
