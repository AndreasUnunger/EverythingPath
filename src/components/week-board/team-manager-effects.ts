import type { ActionId } from '~/components/week-board/types';

export type WeekBoardTeamManager = {
  displayName: string;
  charismaBonus: number;
  maxTeams: number;
  managedTeamCount: number;
  warnings: string[];
} | null;

export type WeekBoardTeamRow = {
  teamId: string;
  manager: WeekBoardTeamManager;
};

export function getTeamManagerSummary(team: WeekBoardTeamRow | undefined) {
  if (!team?.manager) {
    return undefined;
  }

  return `${team.manager.displayName} manager CHA bonus ${formatSigned(team.manager.charismaBonus)} • managing ${team.manager.managedTeamCount}/${team.manager.maxTeams} teams`;
}

export function getSelectedTeamManagerWarnings(
  team: WeekBoardTeamRow | undefined,
) {
  return team?.manager?.warnings ?? [];
}

export function getActionTeamManagerParts({
  actionId,
  stagedActionIds,
  slotTeams,
  teams,
}: {
  actionId: ActionId;
  stagedActionIds: string[];
  slotTeams: Array<string | null>;
  teams: WeekBoardTeamRow[];
}) {
  const relevantTeams = Array.from(
    new Set(
      stagedActionIds.flatMap((stagedActionId, index) =>
        stagedActionId === actionId && slotTeams[index]
          ? [slotTeams[index]]
          : [],
      ),
    ),
  )
    .map((teamId) => teams.find((team) => team.teamId === teamId))
    .filter((team): team is WeekBoardTeamRow => Boolean(team));

  const managers = relevantTeams
    .map((team) => team.manager)
    .filter((manager): manager is Exclude<WeekBoardTeamManager, null> =>
      Boolean(manager),
    );

  if (!managers.length) {
    return undefined;
  }

  const primaryManager = managers[0];
  if (!primaryManager) {
    return undefined;
  }

  if (managers.length === 1) {
    return [
      `${primaryManager.displayName} manager CHA bonus ${formatSigned(primaryManager.charismaBonus)}`,
    ];
  }

  const uniqueBonuses = new Set(
    managers.map((manager) => manager.charismaBonus),
  );
  if (uniqueBonuses.size === 1) {
    return [
      `team manager CHA bonus ${formatSigned(primaryManager.charismaBonus)} across staged teams`,
    ];
  }

  return ['team manager bonuses vary across staged teams'];
}

export function getManipulateEventsChoiceText({
  stagedActionIds,
  slotTeams,
}: {
  stagedActionIds: string[];
  slotTeams: Array<string | null>;
}) {
  const teamId = stagedActionIds.flatMap((actionId, index) =>
    actionId === 'manipulate_events' && slotTeams[index]
      ? [slotTeams[index]]
      : [],
  )[0];
  return teamId
    ? 'Any player can choose which guaranteed event occurs.'
    : undefined;
}

export function getTeamManagerBonusForTeamId(
  teamId: string | undefined,
  teams: WeekBoardTeamRow[],
) {
  if (!teamId) {
    return undefined;
  }

  return teams.find((team) => team.teamId === teamId)?.manager?.charismaBonus;
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
