'use client';

import type { Id } from '@convex/_generated/dataModel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type {
  ActivityAssetOperationsDraft,
  CacheLedgerEntry,
  MarketplaceLedgerEntry,
  OrderLedgerEntry,
  SettlementLedgerEntry,
  TrackedPersonLedgerEntry,
} from '~/components/week-board/activity-asset-operations';
import { ACTION_CARDS } from '~/components/week-board/data';
import type { MilitiaFocus, OfficerEffects } from '~/components/week-board/officer-effects';
import type { ActivityRollTotals } from '~/components/week-board/roll-totals';
import {
  buildRecruitTeamOptions,
  buildUpgradeFromOptions,
  buildUpgradeToOptions,
} from '~/components/week-board/team-options';
import type { WeekBoardTeamManager } from '~/components/week-board/team-manager-effects';
import type { ActionCard, ActionId, DragState } from '~/components/week-board/types';

export type OfficerRole =
  | 'ambassador'
  | 'commandant'
  | 'marshal'
  | 'overseer'
  | 'spymaster'
  | 'strategist';

export type AssignableCharacter = {
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

export type ActivityTeamOperations = {
  recruits: Array<{ slotIndex: number; teamId: string }>;
  dismissals: Array<{ slotIndex: number; teamId: string }>;
  upgrades: Array<{ slotIndex: number; fromTeamId: string; toTeamId: string }>;
};

export type ActivityOfficerOperations = {
  changes: Array<{
    slotIndex: number;
    role: OfficerRole;
    characterId?: Id<'character'>;
  }>;
};

export type ActivityAssetOperations = ActivityAssetOperationsDraft;

export type ActivityPhaseViewModel = {
  dragState: DragState | null;
  setDragStateAction: Dispatch<SetStateAction<DragState | null>>;
  assignedActionIds: Set<ActionId>;
  hasNonLieLowStaged: boolean;
  hasLieLowStaged: boolean;
  slotRows: Array<{
    slotId: string;
    slotNumber: number;
    slotActionId: ActionId | null;
  }>;
  activeDropSlotId: string | null;
  slotRefs: RefObject<Record<string, HTMLDivElement | null>>;
  resetSlotsAction: () => void;
  militiaId: Id<'militia'>;
  organizationId: string;
  currentWeek: number;
  rank: number;
  focus: MilitiaFocus;
  treasury: number;
  maxTeams: number;
  stagedActionIds: ActionId[];
  serverActivityTotals: ActivityRollTotals;
  slotTeams: Array<string | null>;
  activityTeamOperations: ActivityTeamOperations;
  activityOfficerOperations: ActivityOfficerOperations;
  activityAssetOperations: ActivityAssetOperations;
  assignableCharacters: AssignableCharacter[];
  officerAssignments: OfficerAssignments;
  officerEffects: OfficerEffects;
  strategistBonusActionId: ActionId | null;
  teams: Array<{
    teamId: string;
    status: 'active' | 'disabled' | 'missing' | 'blocked';
    manager: WeekBoardTeamManager;
  }>;
  settlements: SettlementLedgerEntry[];
  caches: CacheLedgerEntry[];
  marketplaces: MarketplaceLedgerEntry[];
  orders: OrderLedgerEntry[];
  trackedPeople: TrackedPersonLedgerEntry[];
  activeTeamIds: string[];
  setSlotTeamAction: (slotIndex: number, teamId: string | null) => void;
  setRecruitTeamForSlotAction: (slotIndex: number, teamId: string) => void;
  setDismissTeamForSlotAction: (slotIndex: number, teamId: string) => void;
  setUpgradeTeamsForSlotAction: (
    slotIndex: number,
    fromTeamId?: string,
    toTeamId?: string,
  ) => void;
  setOfficerChangeForSlotAction: (args: {
    slotIndex: number;
    role?: OfficerRole;
    characterId?: Id<'character'> | null;
  }) => void;
  setRefugeSettlementForSlotAction: (slotIndex: number, settlementKey: string) => void;
  setCacheOperationForSlotAction: (args: {
    slotIndex: number;
    mode?: 'place' | 'retrieve';
    cacheId?: string;
    label?: string;
    cacheClass?: 'minor' | 'intermediate' | 'major';
    location?: string;
    contentsSummary?: string;
    isSecureLocation?: boolean;
    checkTotal?: string;
  }) => void;
  setOrderForSlotAction: (args: {
    slotIndex: number;
    description?: string;
    notes?: string;
    costPaid?: string;
    deliveryDays?: string;
  }) => void;
  setMarketplaceForSlotAction: (args: {
    slotIndex: number;
    label?: string;
    purchaseSummary?: string;
    notes?: string;
  }) => void;
  setCovertActionForSlotAction: (args: {
    slotIndex: number;
    mode?: 'augment_action' | 'place_contact';
    targetSource?: 'character' | 'freeform';
    followupSlotIndex?: number;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
    siteName?: string;
    notes?: string;
  }) => void;
  setRescueForSlotAction: (args: {
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
    targetLevel?: string;
    destinationType?: 'hq' | 'refuge' | 'settlement';
    destinationSettlementKey?: string;
  }) => void;
  setRestorationForSlotAction: (args: {
    slotIndex: number;
    targetSource?: 'tracked' | 'character' | 'freeform';
    targetStatusId?: string;
    characterId?: Id<'character'> | null;
    displayName?: string;
    personKind?: 'pc' | 'officer_npc' | 'other_npc' | null;
    mode?:
      | 'party_ability_damage'
      | 'party_hit_points'
      | 'party_lesser_restorative'
      | 'break_enchantment'
      | 'raise_dead'
      | 'restoration'
      | 'stone_to_flesh'
      | 'custom';
    customCostTotal?: string;
  }) => void;
  onErrorAction: (message: string) => void;
};

export type ActivityActionCardEntry = {
  card: ActionCard;
  isDraggingCard: boolean;
  isAssigned: boolean;
  isLegal: boolean;
  isDisabled: boolean;
  costLabel: string;
  warnings: string[];
};

export const ACTION_TEAM_REQUIREMENTS: Record<ActionId, string[] | null> = {
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

export const OFFICER_ROLE_OPTIONS: Array<{ role: OfficerRole; label: string }> = [
  { role: 'ambassador', label: 'Ambassador' },
  { role: 'commandant', label: 'Commandant' },
  { role: 'marshal', label: 'Marshal' },
  { role: 'overseer', label: 'Overseer' },
  { role: 'spymaster', label: 'Spymaster' },
  { role: 'strategist', label: 'Strategist' },
];

export function buildActivityActionEntries({
  dragState,
  assignedActionIds,
  hasNonLieLowStaged,
  hasLieLowStaged,
  rank,
  treasury,
  maxTeams,
  teams,
  activeTeamIds,
}: {
  dragState: DragState | null;
  assignedActionIds: Set<ActionId>;
  hasNonLieLowStaged: boolean;
  hasLieLowStaged: boolean;
  rank: number;
  treasury: number;
  maxTeams: number;
  teams: ActivityPhaseViewModel['teams'];
  activeTeamIds: string[];
}) {
  const minimumTreasury = rank * 10;
  const recruitOptions = buildRecruitTeamOptions({
    teams,
    maxTeams,
  });
  const upgradeFromOptions = buildUpgradeFromOptions({ teams });

  return ACTION_CARDS.map((card): ActivityActionCardEntry => {
    const isDraggingCard =
      dragState?.source === 'deck' && dragState.actionId === card.id;
    const isAssigned = assignedActionIds.has(card.id);
    const costLabel =
      card.id === 'drill_militia' ? `${card.cost} (${minimumTreasury} gp)` : card.cost;
    const violatesLieLowExclusivity =
      (!isAssigned && card.id === 'lie_low' && hasNonLieLowStaged) ||
      (!isAssigned && card.id !== 'lie_low' && hasLieLowStaged);
    const violatesDrillUniqueness = card.id === 'drill_militia' && isAssigned;
    const hardInvalid = violatesLieLowExclusivity || violatesDrillUniqueness;
    const requiredTeamIds = ACTION_TEAM_REQUIREMENTS[card.id];
    const hasRequiredTeam =
      !requiredTeamIds ||
      requiredTeamIds.some((teamId) => activeTeamIds.includes(teamId));

    const meetsActionSpecificRequirements = (() => {
      if (card.id === 'recruit_team') {
        return recruitOptions.some((option) => option.allowed);
      }
      if (card.id === 'dismiss_team') {
        return teams.length > 0;
      }
      if (card.id === 'upgrade_team') {
        return upgradeFromOptions.some((fromOption) =>
          fromOption.allowed
            ? buildUpgradeToOptions({
                fromTeamId: fromOption.value,
                teams,
                treasury,
              }).some((toOption) => toOption.allowed)
            : false,
        );
      }
      if (card.id === 'drill_militia' || card.id === 'guarantee_event') {
        return treasury >= minimumTreasury;
      }
      return true;
    })();

    const warnings: string[] = [];
    if (!hasRequiredTeam) {
      warnings.push('No active team can currently perform this action.');
    }
    if (!meetsActionSpecificRequirements) {
      if (card.id === 'recruit_team') {
        warnings.push('No recruitable team currently fits roster/cap constraints.');
      } else if (card.id === 'dismiss_team') {
        warnings.push('No team is currently available to dismiss.');
      } else if (card.id === 'upgrade_team') {
        warnings.push('No valid affordable upgrade path is currently available.');
      } else if (card.id === 'drill_militia' || card.id === 'guarantee_event') {
        warnings.push(`Treasury is below minimum (${minimumTreasury} gp).`);
      }
    }
    if (violatesLieLowExclusivity) {
      warnings.push('Lie Low must be the only staged action this week.');
    }
    if (violatesDrillUniqueness) {
      warnings.push('Drill Militia can be staged only once per Activity phase.');
    }

    return {
      card,
      isDraggingCard,
      isAssigned,
      isLegal: !hardInvalid && hasRequiredTeam && meetsActionSpecificRequirements,
      isDisabled: hardInvalid,
      costLabel,
      warnings,
    };
  });
}
