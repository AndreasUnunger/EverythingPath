'use client';

import type { Id } from '@convex/_generated/dataModel';
import { abilityModifier } from '~/lib/ability-scores';
import type { ActionId } from '~/components/week-board/types';

export type OfficerRole =
  | 'ambassador'
  | 'commandant'
  | 'marshal'
  | 'overseer'
  | 'spymaster'
  | 'strategist';

export type MilitiaFocus = 'Loyalty' | 'Security' | 'Secrecy' | null | undefined;

export type OrganizationCheckType = 'loyalty' | 'security' | 'secrecy';

export type EventOverseerSupportTarget =
  | 'sabotage'
  | 'cache_discovered'
  | 'theft'
  | 'sickness_twice';

export type OfficerCharacter = {
  _id: Id<'character'>;
  name: string;
  kind: 'pc' | 'officer_npc';
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type OfficerAssignments = {
  ambassador?: Id<'character'>;
  commandant?: Id<'character'>;
  marshal?: Id<'character'>;
  overseer?: Id<'character'>;
  spymaster?: Id<'character'>;
  strategist?: Id<'character'>;
};

export type ActivityOfficerOperations = {
  changes: Array<{
    slotIndex: number;
    role: OfficerRole;
    characterId?: Id<'character'>;
  }>;
};

export type OfficerEffects = {
  focus: MilitiaFocus;
  effectiveAssignments: OfficerAssignments;
  secondaryCheckTypes: OrganizationCheckType[];
  loyaltyBonus: number;
  securityBonus: number;
  secrecyBonus: number;
  commandantTrainingBonus: number;
  strategistBonusActionSlotIndex: number | null;
  overseerEventBonusByCheck: Record<OrganizationCheckType, number>;
};

const EVENT_SUPPORT_TARGET_CHECK_TYPE: Record<
  EventOverseerSupportTarget,
  OrganizationCheckType
> = {
  sabotage: 'secrecy',
  cache_discovered: 'secrecy',
  theft: 'loyalty',
  sickness_twice: 'loyalty',
};

const EVENT_SUPPORT_TARGET_LABEL: Record<EventOverseerSupportTarget, string> = {
  sabotage: 'Sabotage check',
  cache_discovered: 'Cache Discovered mitigation',
  theft: 'Theft mitigation',
  sickness_twice: 'Sickness (Twice) loyalty check',
};

export function getBaseMaxActionsForRank(rank: number) {
  if (rank >= 19) return 6;
  if (rank >= 15) return 5;
  if (rank >= 11) return 4;
  if (rank >= 7) return 3;
  if (rank >= 1) return 2;
  return 1;
}

export function getEffectiveOfficerAssignments({
  baseAssignments,
  slots,
  activityOfficerOperations,
}: {
  baseAssignments: OfficerAssignments;
  slots: Array<ActionId | null>;
  activityOfficerOperations: ActivityOfficerOperations;
}) {
  const nextAssignments: OfficerAssignments = { ...baseAssignments };
  const orderedChanges = [...activityOfficerOperations.changes]
    .filter((change) => slots[change.slotIndex] === 'change_officer_role')
    .sort((a, b) => a.slotIndex - b.slotIndex);

  for (const change of orderedChanges) {
    nextAssignments[change.role] = change.characterId;
  }

  return nextAssignments;
}

export function buildOfficerEffects({
  focus,
  rank,
  characters,
  baseAssignments,
  slots,
  activityOfficerOperations,
}: {
  focus: MilitiaFocus;
  rank: number;
  characters: OfficerCharacter[];
  baseAssignments: OfficerAssignments;
  slots: Array<ActionId | null>;
  activityOfficerOperations: ActivityOfficerOperations;
}) {
  const effectiveAssignments = getEffectiveOfficerAssignments({
    baseAssignments,
    slots,
    activityOfficerOperations,
  });
  const characterById = new Map(characters.map((character) => [character._id, character]));
  const ambassador = effectiveAssignments.ambassador
    ? characterById.get(effectiveAssignments.ambassador)
    : undefined;
  const commandant = effectiveAssignments.commandant
    ? characterById.get(effectiveAssignments.commandant)
    : undefined;
  const marshal = effectiveAssignments.marshal
    ? characterById.get(effectiveAssignments.marshal)
    : undefined;
  const overseer = effectiveAssignments.overseer
    ? characterById.get(effectiveAssignments.overseer)
    : undefined;
  const spymaster = effectiveAssignments.spymaster
    ? characterById.get(effectiveAssignments.spymaster)
    : undefined;

  const secondaryCheckTypes = getSecondaryCheckTypes(focus);
  const secondaryBonus = overseer ? 1 : 0;
  const loyaltyBonus =
    getBestModifier(ambassador, ['constitution', 'charisma']) +
    (secondaryCheckTypes.includes('loyalty') ? secondaryBonus : 0);
  const securityBonus =
    getBestModifier(marshal, ['strength', 'wisdom']) +
    (secondaryCheckTypes.includes('security') ? secondaryBonus : 0);
  const secrecyBonus =
    getBestModifier(spymaster, ['dexterity', 'intelligence']) +
    (secondaryCheckTypes.includes('secrecy') ? secondaryBonus : 0);

  return {
    focus,
    effectiveAssignments,
    secondaryCheckTypes,
    loyaltyBonus,
    securityBonus,
    secrecyBonus,
    commandantTrainingBonus: commandant?.level ?? 0,
    strategistBonusActionSlotIndex: effectiveAssignments.strategist
      ? getBaseMaxActionsForRank(rank)
      : null,
    overseerEventBonusByCheck: {
      loyalty: getBestModifier(overseer, ['charisma', 'constitution']),
      security: getBestModifier(overseer, ['strength', 'wisdom']),
      secrecy: getBestModifier(overseer, ['dexterity', 'intelligence']),
    },
  } satisfies OfficerEffects;
}

export function getCheckBonusTotal({
  checkType,
  officerEffects,
  isStrategistBonusAction = false,
  overseerSupportTarget,
  currentEventTarget,
}: {
  checkType: OrganizationCheckType;
  officerEffects: OfficerEffects;
  isStrategistBonusAction?: boolean;
  overseerSupportTarget?: EventOverseerSupportTarget | '';
  currentEventTarget?: EventOverseerSupportTarget;
}) {
  let total = getBaseOfficerCheckBonus(checkType, officerEffects);
  if (isStrategistBonusAction) {
    total += 2;
  }
  if (
    overseerSupportTarget &&
    currentEventTarget &&
    overseerSupportTarget === currentEventTarget
  ) {
    total += officerEffects.overseerEventBonusByCheck[checkType];
  }
  return total;
}

export function getCheckBonusHelperText({
  checkType,
  officerEffects,
  isStrategistBonusAction = false,
  overseerSupportTarget,
  currentEventTarget,
  additionalParts = [],
}: {
  checkType: OrganizationCheckType;
  officerEffects: OfficerEffects;
  isStrategistBonusAction?: boolean;
  overseerSupportTarget?: EventOverseerSupportTarget | '';
  currentEventTarget?: EventOverseerSupportTarget;
  additionalParts?: string[];
}) {
  const parts: string[] = [...additionalParts];
  const baseOfficerBonus = getBaseOfficerCheckBonus(checkType, officerEffects);

  if (baseOfficerBonus !== 0) {
    parts.push(`${labelForCheckType(checkType)} officer bonus ${formatSigned(baseOfficerBonus)}`);
  }
  if (isStrategistBonusAction) {
    parts.push('Strategist bonus action +2');
  }
  if (
    overseerSupportTarget &&
    currentEventTarget &&
    overseerSupportTarget === currentEventTarget
  ) {
    const eventBonus = officerEffects.overseerEventBonusByCheck[checkType];
    if (eventBonus !== 0) {
      parts.push(`Overseer event support ${formatSigned(eventBonus)}`);
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return `Include ${parts.join(', ')} in the total entered here.`;
}

export function getCommandantTrainingHelperText(officerEffects: OfficerEffects) {
  if (!officerEffects.commandantTrainingBonus) {
    return undefined;
  }
  return `Successful Drill Militia training includes Commandant Hit Dice +${officerEffects.commandantTrainingBonus}.`;
}

export function getEventOverseerSupportOptions({
  officerEffects,
  eventWouldOccurBeforeSabotage,
  resolvedEventNames,
}: {
  officerEffects: OfficerEffects;
  eventWouldOccurBeforeSabotage: boolean;
  resolvedEventNames: string[];
}) {
  if (!officerEffects.effectiveAssignments.overseer) {
    return [];
  }

  const options: Array<{
    value: EventOverseerSupportTarget;
    label: string;
    checkType: OrganizationCheckType;
  }> = [];

  if (eventWouldOccurBeforeSabotage) {
    options.push({
      value: 'sabotage',
      label: EVENT_SUPPORT_TARGET_LABEL.sabotage,
      checkType: 'secrecy',
    });
  }
  if (resolvedEventNames.includes('Cache Discovered')) {
    options.push({
      value: 'cache_discovered',
      label: EVENT_SUPPORT_TARGET_LABEL.cache_discovered,
      checkType: 'secrecy',
    });
  }
  if (resolvedEventNames.includes('Theft')) {
    options.push({
      value: 'theft',
      label: EVENT_SUPPORT_TARGET_LABEL.theft,
      checkType: 'loyalty',
    });
  }
  if (resolvedEventNames.includes('Sickness')) {
    options.push({
      value: 'sickness_twice',
      label: EVENT_SUPPORT_TARGET_LABEL.sickness_twice,
      checkType: 'loyalty',
    });
  }

  return options;
}

export function getEventOverseerSupportLabel(
  target: EventOverseerSupportTarget | '',
) {
  if (!target) return '';
  return EVENT_SUPPORT_TARGET_LABEL[target];
}

export function getRecruitmentCheckType(teamId: string | undefined) {
  if (teamId === 'moles') return 'secrecy';
  if (teamId === 'informants') return 'loyalty';
  if (teamId === 'defenders') return 'security';
  if (teamId === 'patrons') return 'loyalty';
  return undefined;
}

export function getEventSupportTargetCheckType(target: EventOverseerSupportTarget) {
  return EVENT_SUPPORT_TARGET_CHECK_TYPE[target];
}

function getSecondaryCheckTypes(focus: MilitiaFocus): OrganizationCheckType[] {
  if (focus === 'Loyalty') return ['secrecy', 'security'];
  if (focus === 'Security') return ['loyalty', 'secrecy'];
  if (focus === 'Secrecy') return ['loyalty', 'security'];
  return [];
}

function getBestModifier(
  character: OfficerCharacter | undefined,
  keys: Array<
    | 'strength'
    | 'dexterity'
    | 'constitution'
    | 'intelligence'
    | 'wisdom'
    | 'charisma'
  >,
) {
  if (!character) {
    return 0;
  }

  return Math.max(...keys.map((key) => abilityModifier(character[key])));
}

function getBaseOfficerCheckBonus(
  checkType: OrganizationCheckType,
  officerEffects: OfficerEffects,
) {
  if (checkType === 'loyalty') return officerEffects.loyaltyBonus;
  if (checkType === 'security') return officerEffects.securityBonus;
  return officerEffects.secrecyBonus;
}

function labelForCheckType(checkType: OrganizationCheckType) {
  if (checkType === 'loyalty') return 'Loyalty';
  if (checkType === 'security') return 'Security';
  return 'Secrecy';
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}
