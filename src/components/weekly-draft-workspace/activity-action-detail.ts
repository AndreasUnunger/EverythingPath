import { OFFICER_ROLES } from '~/lib/canonical-roster';
import teamTable from '~/lib/militia-team-table';
import { teamRecruitmentCheck } from '~/lib/rules-activity';
import {
  isPartyRestoration,
  restorationCostCopper,
} from '~/lib/rules-character-actions';
import { activityRollSpec } from '~/lib/rules-roll-spec';
import { getTeamCost, isUpgradePathAllowed } from '~/lib/rules-teams';
import type { OrganizationCheck } from '~/lib/rules-officers';
import type { RollSpec } from '~/lib/raw-roll';
import type { StagedActionChoice } from '~/lib/weekly-draft-facts';
import { gp } from '~/components/week-review/review-text';
import { activityLabel } from './activity-labels';
import type { ActivityTeamFact, ActivityView, OfficerRole } from './types';

// Presentation facts for the people and team actions' detail editors. Every
// option list comes from the view's rule-derived facts and the rules
// helpers; groups guide the table and never filter. A recorded reference
// that no longer matches an option stays listed as a missing option.

type Slot = ActivityView['slots'][number];
type Choice<Id extends StagedActionChoice['actionId']> = Extract<
  StagedActionChoice,
  { actionId: Id }
>;
export type PeopleTeamActionId =
  | 'change_officer_role'
  | 'recruit_team'
  | 'upgrade_team'
  | 'dismiss_team'
  | 'rescue_character'
  | 'restore_character'
  | 'drill_militia'
  | 'earn_gold'
  | 'lie_low';
export const PEOPLE_TEAM_ACTIONS: readonly PeopleTeamActionId[] = [
  'change_officer_role',
  'recruit_team',
  'upgrade_team',
  'dismiss_team',
  'rescue_character',
  'restore_character',
  'drill_militia',
  'earn_gold',
  'lie_low',
];
export function isPeopleTeamChoice(
  choice: StagedActionChoice,
): choice is Choice<PeopleTeamActionId> {
  return (PEOPLE_TEAM_ACTIONS as readonly string[]).includes(choice.actionId);
}

export type DetailOption = {
  value: string;
  label: string;
  description: string | null;
  // Listed first. Other options stay selectable with the rules' warning.
  eligible: boolean;
  // The recorded reference no longer matches anything this Activity knows.
  missing: boolean;
};
export type DetailRollField = 'notoriety' | 'training';
export type DetailRoll = {
  field: DetailRollField;
  label: string;
  spec: RollSpec;
  // When the rules use this roll.
  when: string;
  required: boolean;
};
export type DetailConsumables = {
  selected: { value: string; label: string; missing: boolean }[];
  available: { value: string; label: string }[];
};
type Common = {
  rolls: DetailRoll[];
  // Null when the action has no check and nothing is recorded.
  consumables: DetailConsumables | null;
};
export type RecruitmentRule = { check: OrganizationCheck; dc: number };
export type RecruitmentCheckState =
  // The chosen team type has recruitment rules and nothing else is recorded.
  | ({ kind: 'rules' } & RecruitmentRule)
  // The type has no recruitment rules (or is not chosen yet while a table
  // check is recorded): the table chooses the check and DC.
  | { kind: 'table' }
  // A recorded table check the type's own rules replace; kept until cleared.
  | { kind: 'retained'; rules: RecruitmentRule }
  | { kind: 'none' };
type Specific =
  | {
      actionId: 'change_officer_role';
      characters: DetailOption[];
      // The selected character's roles at this slot's position.
      heldRoles: OfficerRole[] | null;
      fromRoles: DetailOption[];
      toRoles: DetailOption[];
    }
  | {
      actionId: 'recruit_team';
      teamTypes: DetailOption[];
      recruitment: RecruitmentCheckState;
    }
  | {
      actionId: 'upgrade_team';
      targets: DetailOption[];
      destinations: DetailOption[];
    }
  | { actionId: 'dismiss_team'; targets: DetailOption[] }
  | {
      actionId: 'rescue_character';
      characters: DetailOption[];
      destinations: DetailOption[];
      // The level the rules use for the selected character.
      ruleLevel: number | null;
    }
  | {
      actionId: 'restore_character';
      modes: DetailOption[];
      // Null until a mode is chosen.
      scope: 'party' | 'individual' | null;
      characters: DetailOption[];
      ruleLevel: number | null;
    }
  | { actionId: 'drill_militia' | 'earn_gold' | 'lie_low' };
export type ActionDetail = Common & Specific;

function option(
  value: string,
  label: string,
  description: string | null,
  eligible = true,
): DetailOption {
  return { value, label, description, eligible, missing: false };
}
function withMissing(
  options: DetailOption[],
  recorded: string | undefined,
  label: string,
): DetailOption[] {
  if (!recorded || options.some((entry) => entry.value === recorded))
    return options;
  return [
    {
      value: recorded,
      label,
      description: 'No longer on the roster',
      eligible: false,
      missing: true,
    },
    ...options,
  ];
}
// Eligible options first, keeping each group's order.
function ordered(options: DetailOption[]) {
  return [
    ...options.filter((entry) => entry.eligible),
    ...options.filter((entry) => !entry.eligible),
  ];
}
function typeFacts(teamType: string | null | undefined) {
  return teamTable.find((entry) => entry.id === teamType);
}
function roleLabel(role: string) {
  return activityLabel(role);
}
function roleList(roles: string[]) {
  return roles.length ? roles.map(roleLabel).join(', ') : 'No officer role';
}

function heldRoles(slot: Slot, characterId: string | undefined) {
  if (!characterId || !slot.position) return null;
  return slot.position.officers
    .filter((officer) => officer.characterId === characterId)
    .map((officer) => officer.role);
}
function status(slot: Slot, characterId: string) {
  return (
    slot.position?.characterStatus.find(
      (entry) => entry.characterId === characterId,
    )?.status ?? null
  );
}
function level(view: ActivityView, characterId: string | undefined) {
  return (
    view.characters.find((entry) => entry.characterId === characterId)?.level ??
    null
  );
}
function characterOptions(
  view: ActivityView,
  recorded: string | undefined,
  describe: (characterId: string, level: number | null) => string | null,
  eligible: (characterId: string) => boolean = () => true,
) {
  return withMissing(
    ordered(
      view.characters.map((character) =>
        option(
          character.characterId,
          character.name,
          describe(character.characterId, character.level),
          eligible(character.characterId),
        ),
      ),
    ),
    recorded,
    'Missing character',
  );
}
function levelText(value: number | null) {
  return value === null ? 'Level unknown' : `Level ${value}`;
}

// Where a team already acts, is upgraded or is dismissed this Activity,
// other than in `slot` (the same use the team dropdown reports).
function teamUse(view: ActivityView, teamId: string, slot: Slot) {
  return view.slots.find(
    (entry) =>
      entry.slotId !== slot.slotId &&
      entry.choice &&
      (entry.choice.teamId === teamId ||
        ('targetTeamId' in entry.choice &&
          entry.choice.targetTeamId === teamId)),
  );
}
function exists(team: ActivityTeamFact, slot: Slot) {
  return team.recruitedInSlot === null || team.recruitedInSlot < slot.number;
}
function teamState(view: ActivityView, team: ActivityTeamFact, slot: Slot) {
  if (team.recruitedInSlot !== null)
    return team.recruitedInSlot < slot.number
      ? `Recruited in Action Slot ${team.recruitedInSlot}`
      : `Recruited later, in Action Slot ${team.recruitedInSlot}`;
  if (team.condition !== 'active') return activityLabel(team.condition);
  if (team.unavailable) return 'Unavailable this Activity';
  const use = teamUse(view, team.teamId, slot);
  return use ? `Acts in Action Slot ${use.number}` : 'Free';
}
function targetOptions(
  view: ActivityView,
  slot: Slot,
  recorded: string | undefined,
  eligible: (team: ActivityTeamFact) => boolean,
) {
  return withMissing(
    ordered(
      view.teamRoster
        .filter((team) => team.recruitedInSlot !== slot.number)
        .map((team) =>
          option(
            team.teamId,
            team.name,
            [
              [team.typeName, team.tier].filter(Boolean).join(' '),
              teamState(view, team, slot),
            ]
              .filter(Boolean)
              .join(' · '),
            eligible(team),
          ),
        ),
    ),
    recorded,
    'Missing team',
  );
}

const rollWhen: Partial<
  Record<PeopleTeamActionId, Partial<Record<DetailRollField, string>>>
> = {
  dismiss_team: {
    notoriety: 'Rolled if the check fails: Notoriety rises by the roll.',
  },
  drill_militia: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
    training:
      'Rolled if the check succeeds: Training rises by the roll plus any Commandant bonus.',
  },
  earn_gold: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
  },
  recruit_team: {
    notoriety: 'Rolled on a natural 1: Notoriety rises by the roll.',
  },
};
function detailRolls(choice: Choice<PeopleTeamActionId>, slot: Slot) {
  return (['training', 'notoriety'] as const).flatMap<DetailRoll>((field) => {
    const spec = activityRollSpec(choice.actionId, field);
    if (!spec) return [];
    return [
      {
        field,
        label: activityLabel(field),
        spec,
        when: rollWhen[choice.actionId]?.[field] ?? '',
        required: slot.requirements.includes(
          `${choice.choiceId}:${field}:${spec.count}d${spec.sides}`,
        ),
      },
    ];
  });
}
function consumables(
  choice: StagedActionChoice,
  slot: Slot,
  view: ActivityView,
): DetailConsumables | null {
  const recorded = choice.consumableIds ?? [];
  if (!slot.check && recorded.length === 0) return null;
  return {
    selected: recorded.map((value) => {
      const known = view.bonuses.find((bonus) => bonus.value === value);
      return {
        value,
        label: known?.label ?? 'Missing bonus',
        missing: !known,
      };
    }),
    available: view.bonuses.filter((bonus) => !recorded.includes(bonus.value)),
  };
}

function recruitmentState(
  choice: Choice<'recruit_team'>,
): RecruitmentCheckState {
  if (!choice.teamType)
    return choice.recruitmentCheck ? { kind: 'table' } : { kind: 'none' };
  const rules = teamRecruitmentCheck(choice.teamType);
  if (!rules) return { kind: 'table' };
  return choice.recruitmentCheck
    ? { kind: 'retained', rules }
    : { kind: 'rules', ...rules };
}

// Rescue's destination as one option value: headquarters or a refuge.
export function destinationValue(choice: Choice<'rescue_character'>) {
  const destination = choice.destination;
  if (!destination) return null;
  return destination.kind === 'headquarters'
    ? 'headquarters'
    : `refuge:${destination.settlementId}`;
}
export function destinationFromValue(
  value: string,
): NonNullable<Choice<'rescue_character'>['destination']> {
  return value.startsWith('refuge:')
    ? { kind: 'refuge', settlementId: value.slice('refuge:'.length) }
    : { kind: 'headquarters' };
}

const RESTORE_MODES = [
  'ability_damage',
  'hit_points',
  'restorative_effect',
  'break_enchantment',
  'raise_dead',
  'restoration',
  'stone_to_flesh',
] as const satisfies readonly NonNullable<
  Choice<'restore_character'>['mode']
>[];

function specific(
  choice: Choice<PeopleTeamActionId>,
  slot: Slot,
  view: ActivityView,
): Specific {
  switch (choice.actionId) {
    case 'change_officer_role': {
      const held = heldRoles(slot, choice.characterId);
      const roles = (
        eligible: (role: OfficerRole) => boolean,
        describe: (role: OfficerRole) => string | null,
      ) =>
        ordered(
          OFFICER_ROLES.map((role) =>
            option(role, roleLabel(role), describe(role), eligible(role)),
          ),
        );
      return {
        actionId: choice.actionId,
        characters: characterOptions(view, choice.characterId, (id) =>
          slot.position ? roleList(heldRoles(slot, id) ?? []) : null,
        ),
        heldRoles: held,
        // Without a character every role stays in one list.
        fromRoles: roles(
          (role) => held === null || held.includes(role),
          (role) => (held?.includes(role) ? 'Held now' : null),
        ),
        toRoles: roles(
          (role) => !held?.includes(role),
          (role) => (held?.includes(role) ? 'Already held' : null),
        ),
      };
    }
    case 'recruit_team':
      return {
        actionId: choice.actionId,
        teamTypes: ordered(
          teamTable.map((entry) => {
            const rules = teamRecruitmentCheck(entry.id);
            return option(
              entry.id,
              entry.name,
              `Tier ${entry.tier} · ${
                rules
                  ? `${activityLabel(rules.check)} DC ${rules.dc}`
                  : 'No recruitment rules'
              }`,
              rules !== null,
            );
          }),
        ),
        recruitment: recruitmentState(choice),
      };
    case 'upgrade_team': {
      const target = view.teamRoster.find(
        (team) => team.teamId === choice.targetTeamId,
      );
      return {
        actionId: choice.actionId,
        targets: targetOptions(
          view,
          slot,
          choice.targetTeamId,
          (team) =>
            exists(team, slot) &&
            team.condition === 'active' &&
            !team.unavailable &&
            !teamUse(view, team.teamId, slot) &&
            Boolean(typeFacts(team.teamType)?.upgrade?.to.length),
        ),
        destinations: ordered(
          teamTable
            .filter((entry) => entry.id !== target?.teamType)
            .map((entry) =>
              option(
                entry.id,
                entry.name,
                `Tier ${entry.tier} · ${gp(getTeamCost(entry.id) * 100)}`,
                target?.teamType !== null &&
                  target?.teamType !== undefined &&
                  isUpgradePathAllowed(target.teamType, entry.id),
              ),
            ),
        ),
      };
    }
    case 'dismiss_team':
      return {
        actionId: choice.actionId,
        targets: targetOptions(view, slot, choice.targetTeamId, (team) =>
          exists(team, slot),
        ),
      };
    case 'rescue_character': {
      const refuges = slot.position?.refugeSettlementIds ?? [];
      const recorded = choice.destination;
      const settlements = view.settlements.map((settlement) =>
        option(
          `refuge:${settlement.value}`,
          `Refuge in ${settlement.label}`,
          refuges.includes(settlement.value)
            ? 'Active refuge'
            : 'No active refuge this week',
          refuges.includes(settlement.value),
        ),
      );
      return {
        actionId: choice.actionId,
        characters: characterOptions(
          view,
          choice.characterId,
          (id, value) =>
            [
              levelText(value),
              status(slot, id) && activityLabel(status(slot, id)!),
            ]
              .filter(Boolean)
              .join(' · '),
          (id) => status(slot, id) === 'captured',
        ),
        destinations: [
          ...(recorded?.kind === 'refuge' &&
          !view.settlements.some(
            (settlement) => settlement.value === recorded.settlementId,
          )
            ? [
                {
                  value: `refuge:${recorded.settlementId}`,
                  label: 'Refuge in a missing settlement',
                  description: 'No longer one of the campaign’s settlements',
                  eligible: false,
                  missing: true,
                },
              ]
            : []),
          option('headquarters', 'Headquarters', null),
          ...ordered(settlements),
        ],
        ruleLevel: level(view, choice.characterId),
      };
    }
    case 'restore_character':
      return {
        actionId: choice.actionId,
        modes: RESTORE_MODES.map((mode) => {
          const cost = restorationCostCopper(mode);
          return option(
            mode,
            activityLabel(mode),
            isPartyRestoration(mode)
              ? 'Every player character'
              : `One character · scroll ${gp(cost)}`,
          );
        }),
        scope: choice.mode
          ? isPartyRestoration(choice.mode)
            ? 'party'
            : 'individual'
          : null,
        characters: characterOptions(
          view,
          choice.characterId,
          (id, value) =>
            [
              levelText(value),
              status(slot, id) && activityLabel(status(slot, id)!),
            ]
              .filter(Boolean)
              .join(' · '),
          (id) => status(slot, id) !== 'captured',
        ),
        ruleLevel: level(view, choice.characterId),
      };
    default:
      return { actionId: choice.actionId };
  }
}

// The detail facts for a people or team action, or null for other actions,
// which keep the general choice editor.
export function actionDetail(
  view: ActivityView,
  slot: Slot,
): ActionDetail | null {
  const choice = slot.choice;
  if (!choice || !isPeopleTeamChoice(choice)) return null;
  return {
    ...specific(choice, slot, view),
    rolls: detailRolls(choice, slot),
    consumables: consumables(choice, slot, view),
  };
}
