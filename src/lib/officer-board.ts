import {
  getEffectiveHitDice,
  rosterWarningDescriptors,
  type CanonicalRoster,
} from './canonical-roster';
import {
  normalizeCharacterKind,
  type CharacterKind,
  type CharacterRecordKind,
} from './character-kind';
import {
  officerAbilitySource,
  projectOfficers,
  type FoundationCharacter,
  type OfficerAbility,
  type OrganizationCheck,
} from './rules-officers';
import { countManagedTeams, getTeamManagerLimit } from './team-manager-rules';
import type { StagedActionChoice } from './weekly-draft-facts';

// What the Characters & officers page shows about the six officer roles and
// the character records. Every number comes from the shared rules
// (`rules-officers`, `canonical-roster`, `team-manager-rules`) applied to the
// accepted roster; pending weekly changes are listed, never applied.

export type OfficerRole = CanonicalRoster['officers'][number]['role'];
type Focus = 'Loyalty' | 'Security' | 'Secrecy';

/** The six roles in board order: three check roles, then the others. */
export const BOARD_ROLES = [
  'marshal',
  'ambassador',
  'spymaster',
  'strategist',
  'commandant',
  'overseer',
] as const satisfies readonly OfficerRole[];

export const ROLE_LABELS: Record<OfficerRole, string> = {
  ambassador: 'Ambassador',
  commandant: 'Commandant',
  marshal: 'Marshal',
  overseer: 'Overseer',
  spymaster: 'Spymaster',
  strategist: 'Strategist',
};

const ROLE_RULES: Record<OfficerRole, string> = {
  marshal: 'Security bonus from Str or Wis',
  ambassador: 'Loyalty bonus from Con or Cha',
  spymaster: 'Secrecy bonus from Dex or Int',
  strategist: '+1 militia action; that action gets +2',
  commandant: 'Hit Dice as training on a successful Drill',
  overseer: '+1 to both secondary checks; adds to one chosen event',
};

const CHECK_ROLES: Partial<Record<OfficerRole, OrganizationCheck>> = {
  marshal: 'security',
  ambassador: 'loyalty',
  spymaster: 'secrecy',
};
const CHECK_LABELS: Record<OrganizationCheck, Focus> = {
  loyalty: 'Loyalty',
  security: 'Security',
  secrecy: 'Secrecy',
};
const ABILITY_LABELS: Record<OfficerAbility, string> = {
  strength: 'Str',
  dexterity: 'Dex',
  constitution: 'Con',
  intelligence: 'Int',
  wisdom: 'Wis',
  charisma: 'Cha',
};
const MISSING_NAME = 'Missing character';

function signed(value: number) {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

/** A Change Officer Role staged in the open week's Activity. */
export type PendingRoleChange = {
  key: string;
  /** The Activity slot, counted from 1. */
  slot: number;
  characterId: string;
  fromRole: OfficerRole | null;
  toRole: OfficerRole | null;
  /** "Kess: Strategist → Spymaster (Activity, slot 2)" */
  text: string;
};

export type RoleHolder = {
  characterId: string;
  name: string;
  archived: boolean;
  /** Whether this holder's bonus is the one the rules use. */
  counts: boolean;
  /** "Security +4" or "5 HD"; null when this holder adds nothing. */
  contribution: string | null;
  /** "Doesn't stack with Grom" for a redundant holder. */
  nonStacking: string | null;
};

export type RoleCard = {
  role: OfficerRole;
  label: string;
  rule: string;
  vacant: boolean;
  holders: RoleHolder[];
  /** The role's current effect, or what its vacancy means. */
  effect: string;
  /** Whose value the effect comes from; null when nobody's does. */
  source: string | null;
  pending: PendingRoleChange[];
};

/** The Change Officer Role actions staged in the open week, in slot order. */
export function pendingRoleChanges(
  slots: readonly { choice: StagedActionChoice | null }[],
  names: ReadonlyMap<string, string>,
): PendingRoleChange[] {
  return slots.flatMap(({ choice }, index) => {
    if (choice?.actionId !== 'change_officer_role' || !choice.characterId)
      return [];
    if (!choice.fromRole && !choice.toRole) return [];
    const role = (value: OfficerRole | undefined) =>
      value ? ROLE_LABELS[value] : 'no role';
    const name = names.get(choice.characterId) ?? MISSING_NAME;
    return [
      {
        key: choice.choiceId,
        slot: index + 1,
        characterId: choice.characterId,
        fromRole: choice.fromRole ?? null,
        toRole: choice.toRole ?? null,
        text: `${name}: ${role(choice.fromRole)} → ${role(choice.toRole)} (Activity, slot ${index + 1})`,
      },
    ];
  });
}

type Holder = {
  characterId: string;
  name: string;
  facts?: FoundationCharacter;
};

function missingHolder({ characterId, name }: Holder): RoleHolder {
  return {
    characterId,
    name,
    archived: false,
    counts: false,
    contribution: null,
    nonStacking: null,
  };
}

// One holder counts; the others are told whose bonus applies instead.
function nonStackingHolders(
  holders: Holder[],
  counting: Holder | undefined,
  contribution: string,
): RoleHolder[] {
  return holders.map((holder) =>
    holder.facts
      ? {
          characterId: holder.characterId,
          name: holder.name,
          archived: !holder.facts.isActive,
          counts: holder === counting,
          contribution: holder === counting ? contribution : null,
          nonStacking:
            holder === counting || !counting
              ? null
              : `Doesn't stack with ${counting.name}`,
        }
      : missingHolder(holder),
  );
}

function checkRoleCard(holders: Holder[], check: OrganizationCheck) {
  const label = CHECK_LABELS[check];
  let best: {
    holder: Holder;
    ability: OfficerAbility;
    modifier: number;
  } | null = null;
  for (const holder of holders) {
    if (!holder.facts) continue;
    const source = officerAbilitySource(holder.facts, check);
    if (!best || source.modifier > best.modifier) best = { holder, ...source };
  }
  if (!best)
    return {
      effect: `No ${label} bonus`,
      source: null,
      holders: holders.map(missingHolder),
    };
  const effect = `${label} ${signed(best.modifier)}`;
  return {
    effect,
    source: `${best.holder.name}, ${ABILITY_LABELS[best.ability]}`,
    holders: nonStackingHolders(holders, best.holder, effect),
  };
}

/** The six role cards for the accepted roster and the open week's changes. */
export function officerBoard({
  roster,
  characters,
  names,
  focus,
  pending,
}: {
  roster: CanonicalRoster;
  /** The rules facts of the campaign's characters. */
  characters: FoundationCharacter[];
  names: ReadonlyMap<string, string>;
  focus: Focus | null;
  pending: readonly PendingRoleChange[];
}): RoleCard[] {
  const officers = projectOfficers(roster, characters, focus);
  const byId = new Map(characters.map((x) => [x.characterId, x]));
  const hitDice = (holder: Holder & { facts: FoundationCharacter }) => {
    const person = roster.people.find(
      (x) => x.characterId === holder.characterId,
    );
    return person ? getEffectiveHitDice(person, holder.facts) : 0;
  };
  const secondary = focus
    ? (['loyalty', 'secrecy', 'security'] as const)
        .map((check) => CHECK_LABELS[check])
        .filter((check) => check !== focus)
    : [];

  return BOARD_ROLES.map((role) => {
    const holders: Holder[] = roster.officers
      .filter((officer) => officer.role === role)
      .map(({ characterId }) => ({
        characterId,
        name: names.get(characterId) ?? MISSING_NAME,
        facts: byId.get(characterId),
      }));
    const present = holders.filter(
      (holder): holder is Holder & { facts: FoundationCharacter } =>
        holder.facts !== undefined,
    );
    const check = CHECK_ROLES[role];
    const shown = check
      ? checkRoleCard(holders, check)
      : role === 'commandant'
        ? {
            effect: present.length
              ? `+${officers.commandantTrainingBonus} training on a successful Drill`
              : 'No Drill training bonus',
            source: present.length
              ? present
                  .map((holder) => `${holder.name} ${hitDice(holder)} HD`)
                  .join(' + ')
              : null,
            // Commandants stack: every distinct holder counts.
            holders: holders.map((holder) =>
              holder.facts
                ? {
                    characterId: holder.characterId,
                    name: holder.name,
                    archived: !holder.facts.isActive,
                    counts: true,
                    contribution: `${hitDice({ ...holder, facts: holder.facts })} HD`,
                    nonStacking: null,
                  }
                : missingHolder(holder),
            ),
          }
        : role === 'strategist'
          ? {
              effect: officers.strategistAssigned
                ? ROLE_RULES.strategist
                : 'No extra action',
              source: present[0]?.name ?? null,
              holders: nonStackingHolders(
                holders,
                present[0],
                '+1 action, +2 on it',
              ),
            }
          : {
              effect: !present.length
                ? 'No secondary-check bonus'
                : secondary.length
                  ? `+1 to ${secondary.join(' and ')}; supports one chosen event's checks`
                  : "Supports one chosen event's checks",
              source: present[0]?.name ?? null,
              holders: nonStackingHolders(
                holders,
                present[0],
                secondary.length
                  ? `+1 ${secondary.join(', ')}`
                  : 'Supports one event',
              ),
            };
    return {
      role,
      label: ROLE_LABELS[role],
      rule: ROLE_RULES[role],
      vacant: holders.length === 0,
      ...shown,
      pending: pending.filter(
        (change) => change.fromRole === role || change.toRole === role,
      ),
    };
  });
}

/** The record fields a row needs. */
export type BoardRecord = {
  _id: string;
  name: string;
  kind?: CharacterRecordKind;
  level: number;
  charisma: number;
  isActive?: boolean;
};

export type CharacterRow = {
  characterId: string;
  name: string;
  kind: CharacterKind;
  archived: boolean;
  onRoster: boolean;
  /** The roster's override, zero included, or else the record's number. */
  hitDice: number;
  /** Held roles, in board order. */
  roles: OfficerRole[];
  /** Managed teams against the role-aware limit; null off the roster. */
  manages: { count: number; limit: number; teams: string[] } | null;
  /** This person's advisory roster warnings. */
  warnings: string[];
};

/** Every character record, alphabetically, with its roster facts. */
export function characterRows({
  records,
  roster,
  characters,
}: {
  records: readonly BoardRecord[];
  /** The accepted roster; null before the militia is set up. */
  roster: CanonicalRoster | null;
  /** The rules facts of the campaign's characters. */
  characters: readonly FoundationCharacter[];
}): CharacterRow[] {
  const facts = new Map(characters.map((x) => [x.characterId, x]));
  const warnings = roster
    ? rosterWarningDescriptors(
        roster,
        records.map((record) => ({
          characterId: record._id,
          name: record.name,
          charisma: facts.get(record._id)?.charisma ?? record.charisma,
          isActive:
            facts.get(record._id)?.isActive ?? record.isActive !== false,
        })),
        Number.POSITIVE_INFINITY,
      )
    : [];
  return [...records]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name, undefined, {
          sensitivity: 'base',
        }) || left._id.localeCompare(right._id),
    )
    .map((record) => {
      const person = roster?.people.find((x) => x.characterId === record._id);
      const rules = facts.get(record._id) ?? record;
      return {
        characterId: record._id,
        name: record.name,
        kind: normalizeCharacterKind(record.kind),
        archived: record.isActive === false,
        onRoster: person !== undefined,
        hitDice: person ? getEffectiveHitDice(person, rules) : record.level,
        roles: roster
          ? BOARD_ROLES.filter((role) =>
              roster.officers.some(
                (officer) =>
                  officer.role === role && officer.characterId === record._id,
              ),
            )
          : [],
        manages:
          roster && person
            ? {
                count: countManagedTeams(roster.teams, record._id),
                limit: getTeamManagerLimit({
                  officers: roster.officers,
                  person,
                  charisma: rules.charisma,
                }),
                teams: roster.teams
                  .filter((team) => team.managerCharacterId === record._id)
                  .map((team) => team.name),
              }
            : null,
        warnings: warnings
          .filter((warning) => warning.characterId === record._id)
          .map((warning) => warning.message),
      };
    });
}

function joined(values: string[]) {
  return values.length < 2
    ? (values[0] ?? '')
    : `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

/**
 * "Manages 2 of 3 teams", "Manages 1 of 1 team", "Manages 2 of 1 teams" or
 * "Manages no teams".
 */
export function managesText(manages: NonNullable<CharacterRow['manages']>) {
  if (manages.count === 0) return 'Manages no teams';
  const noun = manages.limit === 1 && manages.count === 1 ? 'team' : 'teams';
  return `Manages ${manages.count} of ${manages.limit} ${noun}`;
}

/** What archiving this character keeps, or null when they hold nothing. */
export function archiveKeeps(row: CharacterRow): string | null {
  const kept = [
    ...(row.roles.length
      ? [joined(row.roles.map((role) => ROLE_LABELS[role]))]
      : []),
    ...(row.manages?.count ? [`manager of ${joined(row.manages.teams)}`] : []),
  ];
  return kept.length
    ? `Archiving keeps ${row.name} as ${kept.join(' and ')}.`
    : null;
}
