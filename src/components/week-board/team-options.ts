import type { TeamStatus } from '~/lib/militia-domain';

export type TeamStateRow = {
  teamId: string;
  status: TeamStatus;
};

type TeamDef = {
  id: string;
  tier: 1 | 2 | 3;
  upgradeTo: string[];
  upgradeCost?: number;
};

const TEAM_DEFS: TeamDef[] = [
  { id: 'moles', tier: 1, upgradeTo: ['propagandists'], upgradeCost: 250 },
  { id: 'propagandists', tier: 2, upgradeTo: ['saboteurs', 'spies'], upgradeCost: 1000 },
  { id: 'saboteurs', tier: 3, upgradeTo: [] },
  { id: 'spies', tier: 3, upgradeTo: [] },
  { id: 'informants', tier: 1, upgradeTo: ['conspirators'], upgradeCost: 250 },
  { id: 'conspirators', tier: 2, upgradeTo: ['scholars', 'spellcasters'], upgradeCost: 1000 },
  { id: 'scholars', tier: 3, upgradeTo: [] },
  { id: 'spellcasters', tier: 3, upgradeTo: [] },
  { id: 'defenders', tier: 1, upgradeTo: ['infiltrators'], upgradeCost: 250 },
  { id: 'infiltrators', tier: 2, upgradeTo: ['guardians', 'specialists'], upgradeCost: 1000 },
  { id: 'guardians', tier: 3, upgradeTo: [] },
  { id: 'specialists', tier: 3, upgradeTo: [] },
  { id: 'patrons', tier: 1, upgradeTo: ['merchants'], upgradeCost: 50 },
  { id: 'merchants', tier: 2, upgradeTo: ['blackMarketeers', 'fixers'], upgradeCost: 200 },
  { id: 'blackMarketeers', tier: 3, upgradeTo: [] },
  { id: 'fixers', tier: 3, upgradeTo: [] },
];

const BY_ID = new Map(TEAM_DEFS.map((team) => [team.id, team]));

export type TeamOption = {
  value: string;
  label: string;
  warning?: string;
  allowed: boolean;
};

export function buildRecruitTeamOptions({
  teams,
  maxTeams,
}: {
  teams: TeamStateRow[];
  maxTeams: number;
}) {
  const roster = new Set(teams.map((team) => team.teamId));
  return TEAM_DEFS.map((team) => {
    const warnings: string[] = [];
    if (team.tier !== 1) {
      warnings.push('only tier 1 teams are recruited');
    }
    if (roster.has(team.id)) {
      warnings.push('already in roster');
    }
    if (teams.length >= maxTeams) {
      warnings.push(`team cap reached (${maxTeams})`);
    }
    return {
      value: team.id,
      label: team.id,
      warning: warnings.length ? warnings.join('; ') : undefined,
      allowed: warnings.length === 0,
    };
  });
}

export function buildUpgradeFromOptions({
  teams,
}: {
  teams: TeamStateRow[];
}) {
  const roster = new Set(teams.map((team) => team.teamId));
  return TEAM_DEFS.map((team) => {
    const warnings: string[] = [];
    if (!roster.has(team.id)) {
      warnings.push('not in roster');
    }
    if (!team.upgradeTo.length) {
      warnings.push('no further upgrade path');
    }
    return {
      value: team.id,
      label: team.id,
      warning: warnings.length ? warnings.join('; ') : undefined,
      allowed: warnings.length === 0,
    };
  });
}

export function buildUpgradeToOptions({
  fromTeamId,
  teams,
  treasury,
}: {
  fromTeamId: string;
  teams: TeamStateRow[];
  treasury: number;
}) {
  const from = BY_ID.get(fromTeamId);
  const roster = new Set(teams.map((team) => team.teamId));
  return TEAM_DEFS.map((team) => {
    const warnings: string[] = [];
    if (!fromTeamId.trim()) {
      warnings.push('select an upgrade source first');
    }
    if (from && !from.upgradeTo.includes(team.id)) {
      warnings.push(`not a valid upgrade target from ${from.id}`);
    }
    if (from?.upgradeCost !== undefined && treasury < from.upgradeCost) {
      warnings.push(`needs ${from.upgradeCost} gp, treasury is ${treasury} gp`);
    }
    if (roster.has(team.id)) {
      warnings.push('already in roster');
    }
    return {
      value: team.id,
      label: team.id,
      warning: warnings.length ? warnings.join('; ') : undefined,
      allowed: warnings.length === 0,
    };
  });
}

export function getTeamTier(teamId: string | null | undefined) {
  if (!teamId) return undefined;
  return BY_ID.get(teamId)?.tier;
}
