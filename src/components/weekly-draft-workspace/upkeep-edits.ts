import type { RawRoll } from '~/lib/weekly-draft-facts';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { UpkeepDisabledTeam, UpkeepLegacyRemoval } from './types';

// Sends one Weekly Draft edit through the shared ordered store.
export type UpkeepEdit = (edit: WeeklyDraftEdit) => unknown;

// Weekly Draft edits behind the Upkeep team controls. Each goes through the
// existing `upkeep_team` operation, so its atomic recovery adjustment and
// latest-edit-wins ordering are unchanged.

// Recover at the rules cost; any earlier price change is cleared.
export function recoverTeam(team: UpkeepDisabledTeam): WeeklyDraftEdit {
  return {
    kind: 'upkeep_team',
    teamId: team.teamId,
    decision: {
      teamId: team.teamId,
      decision: 'recover',
      costCopper: team.rulesCostCopper,
    },
    recoveryAdjustment: null,
  };
}

// Leaving a team disabled also removes its recovery adjustment.
export function leaveTeamDisabled(teamId: string): WeeklyDraftEdit {
  return {
    kind: 'upkeep_team',
    teamId,
    decision: { teamId, decision: 'leave' },
  };
}

// A missing team's return check is stored on its (leave) decision; a blank
// clears the roll and keeps the decision.
export function missingTeamReturnRoll(
  teamId: string,
  roll: RawRoll | null,
): WeeklyDraftEdit {
  return {
    kind: 'upkeep_team',
    teamId,
    decision: { teamId, decision: 'leave', ...(roll ? { roll } : {}) },
  };
}

// Clears a staged decision the page no longer offers (a retained Remove, or
// one for a team no longer on the roster), with the removal's reasoned
// exception so no ruling survives for a removal that will not happen.
export function clearTeamDecision(
  teamId: string,
  removal: UpkeepLegacyRemoval | null = null,
): WeeklyDraftEdit[] {
  return [
    { kind: 'upkeep_team', teamId, decision: null },
    ...(removal?.exceptionId
      ? [
          {
            kind: 'clear_rules_exception' as const,
            exceptionId: removal.exceptionId,
          },
        ]
      : []),
  ];
}

export function recoveryFundsException(
  team: UpkeepDisabledTeam,
  reason: string,
): WeeklyDraftEdit | null {
  if (!team.fundsException) return null;
  return {
    kind: 'rules_exception',
    exception: {
      exceptionId: team.fundsException.exceptionId,
      subjectId: team.teamId,
      ruleId: 'upkeep-recovery-funds',
      reason,
    },
  };
}
