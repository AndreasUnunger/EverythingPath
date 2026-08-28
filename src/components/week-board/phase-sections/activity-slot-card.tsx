'use client';

import type { Id } from '@convex/_generated/dataModel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Input } from '~/components/ui/input';
import { Card } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  getCacheDc,
  type CacheLedgerEntry,
  type SettlementLedgerEntry,
  type TrackedPersonLedgerEntry,
} from '~/components/week-board/activity-asset-operations';
import {
  buildAssignedTeamOptions,
  buildRetrieveCacheOptions,
  buildSecureCacheClassOptions,
  buildSecureLocationOptions,
  getAssignedTeamContextLines,
  getSecureCacheSelectionWarnings,
} from '~/components/week-board/activity-team-context';
import { ACTION_CARDS } from '~/components/week-board/data';
import {
  getCheckBonusHelperText,
  type OfficerEffects,
} from '~/components/week-board/officer-effects';
import {
  type ActivityAssetOperations,
  type ActivityOfficerOperations,
  type ActivityTeamOperations,
  type AssignableCharacter,
  type OfficerAssignments,
  OFFICER_ROLE_OPTIONS,
  type OfficerRole,
} from '~/components/week-board/phase-sections/activity-phase-shared';
import {
  buildRecruitTeamOptions,
  buildUpgradeFromOptions,
  buildUpgradeToOptions,
} from '~/components/week-board/team-options';
import {
  getSelectedTeamManagerWarnings,
  getTeamManagerSummary,
  type WeekBoardTeamManager,
} from '~/components/week-board/team-manager-effects';
import type { ActionId, DragState } from '~/components/week-board/types';
import {
  formatMarketplaceAvailabilityTier,
  getMarketplaceProfile,
} from '~/lib/militia-marketplace-rules';
import {
  createPointerCardDragState,
  getPointerCardDragStyle,
  shouldIgnorePointerCardDragStart,
} from '~/lib/pointer-card-drag';
import type { TeamStatus } from '~/lib/militia-domain';

type ActivitySlotCardProps = {
  slotId: string;
  slotNumber: number;
  slotActionId: ActionId | null;
  dragState: DragState | null;
  activeDropSlotId: string | null;
  slotRefs: RefObject<Record<string, HTMLDivElement | null>>;
  slotTeams: Array<string | null>;
  activityTeamOperations: ActivityTeamOperations;
  activityOfficerOperations: ActivityOfficerOperations;
  activityAssetOperations: ActivityAssetOperations;
  teams: Array<{
    teamId: string;
    status: TeamStatus;
    manager: WeekBoardTeamManager;
  }>;
  settlements: SettlementLedgerEntry[];
  caches: CacheLedgerEntry[];
  marketplaces: Array<{ _id: string }>;
  orders: Array<{ _id: string; description: string }>;
  trackedPeople: TrackedPersonLedgerEntry[];
  activeTeamIds: string[];
  assignableCharacters: AssignableCharacter[];
  officerAssignments: OfficerAssignments;
  officerEffects: OfficerEffects;
  strategistBonusActionId: ActionId | null;
  maxTeams: number;
  treasury: number;
  setDragStateAction: Dispatch<SetStateAction<DragState | null>>;
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
  setReduceDangerTargetForSlotAction: (
    slotIndex: number,
    settlementKey: string,
  ) => void;
  setSpreadPropagandaTargetForSlotAction: (
    slotIndex: number,
    settlementKey: string,
  ) => void;
  setStrikeTeamForSlotAction: (args: {
    slotIndex: number;
    mode?: 'combat_support' | 'extraction';
    location?: string;
    notes?: string;
  }) => void;
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
};

export function ActivitySlotCard({
  slotId,
  slotNumber,
  slotActionId,
  dragState,
  activeDropSlotId,
  slotRefs,
  slotTeams,
  activityTeamOperations,
  activityOfficerOperations,
  activityAssetOperations,
  teams,
  settlements,
  caches,
  marketplaces: _marketplaces,
  orders: _orders,
  trackedPeople,
  activeTeamIds,
  assignableCharacters,
  officerAssignments,
  officerEffects,
  strategistBonusActionId,
  maxTeams,
  treasury,
  setDragStateAction,
  setSlotTeamAction,
  setRecruitTeamForSlotAction,
  setDismissTeamForSlotAction,
  setUpgradeTeamsForSlotAction,
  setOfficerChangeForSlotAction,
  setRefugeSettlementForSlotAction,
  setReduceDangerTargetForSlotAction,
  setSpreadPropagandaTargetForSlotAction,
  setStrikeTeamForSlotAction,
  setCacheOperationForSlotAction,
  setOrderForSlotAction,
  setMarketplaceForSlotAction,
  setCovertActionForSlotAction,
  setRescueForSlotAction,
  setRestorationForSlotAction,
}: ActivitySlotCardProps) {
  const action = ACTION_CARDS.find((card) => card.id === slotActionId);
  const slotIndex = slotNumber - 1;
  const assignedTeamId = slotTeams[slotIndex] ?? '';
  const recruitEntry = activityTeamOperations.recruits.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const dismissEntry = activityTeamOperations.dismissals.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const upgradeEntry = activityTeamOperations.upgrades.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const officerEntry = activityOfficerOperations.changes.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const refugeEntry = activityAssetOperations.refuges.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const reduceDangerEntry = activityAssetOperations.reduceDangerTargets.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const spreadPropagandaEntry =
    activityAssetOperations.spreadPropagandaTargets.find(
      (entry) => entry.slotIndex === slotIndex,
    );
  const strikeTeamEntry = activityAssetOperations.strikeTeams.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const cacheEntry = activityAssetOperations.caches.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const orderEntry = activityAssetOperations.orders.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const marketplaceEntry = activityAssetOperations.marketplaces.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const covertEntry = activityAssetOperations.covertActions.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const rescueEntry = activityAssetOperations.rescues.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const restorationEntry = activityAssetOperations.restorations.find(
    (entry) => entry.slotIndex === slotIndex,
  );
  const recruitOptions = buildRecruitTeamOptions({
    teams,
    maxTeams,
  });
  const upgradeFromOptions = buildUpgradeFromOptions({ teams });
  const upgradeToOptions = buildUpgradeToOptions({
    fromTeamId: upgradeEntry?.fromTeamId ?? '',
    teams,
    treasury,
  });
  const isActiveDropSlot = activeDropSlotId === slotId;
  const isDraggingFromThisSlot =
    dragState?.sourceSlotIndex === slotIndex && dragState.actionId === slotActionId;
  const selectedRetrieveCache =
    cacheEntry?.mode === 'retrieve' && cacheEntry.cacheId
      ? caches.find((cache) => cache._id === cacheEntry.cacheId)
      : undefined;
  const assignedTeamOptions = action
    ? buildAssignedTeamOptions({
        actionId: action.id,
        activeTeamIds,
      })
    : [];
  const actionTeamContextLines = action
    ? getAssignedTeamContextLines({
        actionId: action.id,
        assignedTeamId: assignedTeamId || undefined,
      })
    : [];
  const settlementOptions = settlements.map((settlement) => ({
    value: settlement.settlementKey,
    label: settlement.settlementKey,
  }));
  const refugeTargetExists = settlementOptions.some(
    (option) => option.value === refugeEntry?.settlementKey,
  );
  const reduceDangerTargetExists = settlementOptions.some(
    (option) => option.value === reduceDangerEntry?.settlementKey,
  );
  const spreadPropagandaTargetExists = settlementOptions.some(
    (option) => option.value === spreadPropagandaEntry?.settlementKey,
  );
  const selectedAssignedTeamWarning = assignedTeamOptions.find(
    (option) => option.value === assignedTeamId,
  )?.warning;
  const selectedAssignedTeam = teams.find((team) => team.teamId === assignedTeamId);
  const selectedTeamManagerSummary = getTeamManagerSummary(selectedAssignedTeam);
  const selectedTeamManagerWarnings = getSelectedTeamManagerWarnings(
    selectedAssignedTeam,
  );
  const secureCacheClassOptions = buildSecureCacheClassOptions(
    assignedTeamId || undefined,
  );
  const secureLocationOptions = buildSecureLocationOptions(
    assignedTeamId || undefined,
  );
  const hiddenCacheOptions = buildRetrieveCacheOptions({
    assignedTeamId: assignedTeamId || undefined,
    caches,
  });
  const secureCacheWarnings =
    action?.id === 'secure_cache'
      ? getSecureCacheSelectionWarnings({
          assignedTeamId: assignedTeamId || undefined,
          cacheClass:
            cacheEntry?.mode === 'place' ? cacheEntry.cacheClass : undefined,
          isSecureLocation:
            cacheEntry?.mode === 'place' ? cacheEntry.isSecureLocation : undefined,
          retrieveCache: selectedRetrieveCache,
        })
      : [];
  const cacheCheckPlaceholder =
    cacheEntry?.mode === 'place' && cacheEntry.cacheClass
      ? `Enter Secrecy check total (DC ${getCacheDc({
          cacheClass: cacheEntry.cacheClass,
          isSecureLocation: cacheEntry.isSecureLocation,
        })})`
      : cacheEntry?.mode === 'retrieve'
        ? 'Enter Secrecy check total to retrieve this cache'
        : 'Select cache mode first';
  const secureCacheCheckHelperText =
    action?.id === 'secure_cache'
      ? getCheckBonusHelperText({
          checkType: 'secrecy',
          officerEffects,
          isStrategistBonusAction: strategistBonusActionId === 'secure_cache',
          additionalParts:
            selectedAssignedTeam?.manager
              ? [
                  `${selectedAssignedTeam.manager.displayName} manager CHA bonus ${
                    selectedAssignedTeam.manager.charismaBonus >= 0
                      ? `+${selectedAssignedTeam.manager.charismaBonus}`
                      : selectedAssignedTeam.manager.charismaBonus
                  }`,
                ]
              : undefined,
        })
      : undefined;
  const marketplaceProfile =
    action?.id === 'broker_market' || action?.id === 'activate_black_market'
      ? getMarketplaceProfile({
          actionId: action.id,
          teamId: assignedTeamId || undefined,
        })
      : null;
  const activeRefugeOptions = settlements
    .filter((settlement) => settlement.refugeActiveUntilWeek !== undefined)
    .map((settlement) => ({
      value: settlement.settlementKey,
      label: settlement.settlementKey,
    }));
  const capturedTrackedPeople = trackedPeople
    .filter((person) => person.status === 'captured')
    .map((person) => ({
      value: person._id,
      label: buildTrackedPersonLabel(person),
    }));
  const restoreTrackedPeople = trackedPeople
    .filter((person) => person.status !== 'contact')
    .map((person) => ({
      value: person._id,
      label: buildTrackedPersonLabel(person),
    }));
  const rescueTargetSource = getTargetSource({
    explicitSource: rescueEntry?.targetSource,
    targetStatusId: rescueEntry?.targetStatusId,
    characterId: rescueEntry?.characterId,
    displayName: rescueEntry?.displayName,
  });
  const restoreTargetSource = getTargetSource({
    explicitSource: restorationEntry?.targetSource,
    targetStatusId: restorationEntry?.targetStatusId,
    characterId: restorationEntry?.characterId,
    displayName: restorationEntry?.displayName,
  });
  const covertTargetSource = getTargetSource({
    explicitSource: covertEntry?.targetSource,
    characterId: covertEntry?.characterId,
    displayName: covertEntry?.displayName,
  });

  return (
    <div
      ref={(element) => {
        slotRefs.current[slotId] = element;
      }}
      className={getSlotContainerClassName({
        hasAction: Boolean(action),
        isActiveDropSlot,
        isDraggingFromThisSlot,
      })}
    >
      <p className="font-mono text-sm">Activity Slot {slotNumber}</p>
      {action ? (
        <div
          className="mt-2"
          style={
            isDraggingFromThisSlot && dragState ? { height: dragState.height } : undefined
          }
        >
          <Card
            data-slot-card="true"
            onPointerDown={(event) => {
              if (shouldIgnorePointerCardDragStart(event.target)) {
                return;
              }
              event.preventDefault();
              setDragStateAction(
                createPointerCardDragState({
                  event,
                  actionId: action.id,
                  source: 'slot',
                  sourceSlotIndex: slotIndex,
                }),
              );
            }}
            className={getSlotCardClassName(isDraggingFromThisSlot)}
            style={isDraggingFromThisSlot ? getDraggingSlotCardStyle(dragState) : undefined}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold">{action.title}</p>
              <span className="border-primary/40 bg-primary/5 rounded px-2 py-0.5 font-mono text-[10px] uppercase">
                Staged
              </span>
            </div>

            <div className="space-y-2">
              {action.team !== 'No Team Required' ? (
                <div className="space-y-1">
                  <SelectField
                    label="Assigned team"
                    value={assignedTeamId || undefined}
                    placeholder="Select team for this slot"
                    options={assignedTeamOptions}
                    onValueChange={(value) =>
                      setSlotTeamAction(slotIndex, value ? value : null)
                    }
                  />
                  {actionTeamContextLines.map((line) => (
                    <p key={line} className="text-muted-foreground font-mono text-xs">
                      {line}
                    </p>
                  ))}
                  {selectedTeamManagerSummary ? (
                    <p className="text-muted-foreground font-mono text-xs">
                      {selectedTeamManagerSummary}
                    </p>
                  ) : null}
                  {selectedAssignedTeamWarning ? (
                    <p className="text-amber-700 font-mono text-xs">
                      Rules warning: {selectedAssignedTeamWarning}.
                    </p>
                  ) : null}
                  {selectedTeamManagerWarnings.map((warning) => (
                    <p key={warning} className="text-amber-700 font-mono text-xs">
                      Rules warning: {warning}.
                    </p>
                  ))}
                </div>
              ) : null}

              {action.id === 'recruit_team' ? (
                <SelectField
                  label="Recruit team"
                  value={recruitEntry?.teamId ?? undefined}
                  placeholder="Select recruited team"
                  includeNone
                  options={recruitOptions.map((option) => ({
                    value: option.value,
                    label: option.warning
                      ? `${option.label} [warning: ${option.warning}]`
                      : `${option.label} [allowed]`,
                  }))}
                  onValueChange={(value) =>
                    setRecruitTeamForSlotAction(
                      slotIndex,
                      value === '__none__' ? '' : value,
                    )
                  }
                />
              ) : null}

              {action.id === 'dismiss_team' ? (
                <SelectField
                  label="Dismiss team"
                  value={dismissEntry?.teamId ?? undefined}
                  placeholder="Select dismissed team"
                  includeNone
                  options={teams.map((team) => ({
                    value: team.teamId,
                    label: team.teamId,
                  }))}
                  onValueChange={(value) =>
                    setDismissTeamForSlotAction(
                      slotIndex,
                      value === '__none__' ? '' : value,
                    )
                  }
                />
              ) : null}

              {action.id === 'upgrade_team' ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <SelectField
                    label="Upgrade from"
                    value={upgradeEntry?.fromTeamId ?? undefined}
                    placeholder="Select current team"
                    includeNone
                    options={upgradeFromOptions.map((option) => ({
                      value: option.value,
                      label: option.warning
                        ? `${option.label} [warning: ${option.warning}]`
                        : `${option.label} [allowed]`,
                    }))}
                    onValueChange={(value) =>
                      setUpgradeTeamsForSlotAction(
                        slotIndex,
                        value === '__none__' ? '' : value,
                        undefined,
                      )
                    }
                  />
                  <SelectField
                    label="Upgrade to"
                    value={upgradeEntry?.toTeamId ?? undefined}
                    placeholder="Select upgraded team"
                    includeNone
                    disabled={!upgradeEntry?.fromTeamId}
                    options={upgradeToOptions.map((option) => ({
                      value: option.value,
                      label: option.warning
                        ? `${option.label} [warning: ${option.warning}]`
                        : `${option.label} [allowed]`,
                    }))}
                    onValueChange={(value) =>
                      setUpgradeTeamsForSlotAction(
                        slotIndex,
                        undefined,
                        value === '__none__' ? '' : value,
                      )
                    }
                  />
                </div>
              ) : null}

              {action.id === 'change_officer_role' ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <SelectField
                    label="Officer role"
                    value={officerEntry?.role ?? undefined}
                    placeholder="Select role to change"
                    includeNone
                    options={OFFICER_ROLE_OPTIONS.map((option) => ({
                      value: option.role,
                      label: option.label,
                    }))}
                    onValueChange={(value) =>
                      setOfficerChangeForSlotAction({
                        slotIndex,
                        role: value === '__none__' ? undefined : (value as OfficerRole),
                      })
                    }
                  />
                  <SelectField
                    label="Assign character"
                    value={officerEntry?.characterId ?? undefined}
                    placeholder={
                      officerEntry?.role ? 'Select character' : 'Select role first'
                    }
                    noneLabel="Unassign"
                    includeNone
                    disabled={!officerEntry?.role}
                    options={assignableCharacters.map((character) => ({
                      value: character._id,
                      label: `${character.name} (L${character.level}, ${character.kind})`,
                    }))}
                    onValueChange={(value) =>
                      setOfficerChangeForSlotAction({
                        slotIndex,
                        characterId:
                          value === '__none__' ? null : (value as Id<'character'>),
                      })
                    }
                  />
                  {officerEntry?.role ? (
                    <p className="text-muted-foreground font-mono text-xs md:col-span-2">
                      Current: {getOfficerAssignmentName(officerEntry.role, officerAssignments, assignableCharacters)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action.id === 'activate_refuge' ? (
                <div className="space-y-1">
                  <SelectField
                    label="Target settlement"
                    value={refugeTargetExists ? refugeEntry?.settlementKey : undefined}
                    placeholder={
                      settlementOptions.length > 0
                        ? 'Select tracked settlement'
                        : 'Add tracked settlements in Ledger first'
                    }
                    includeNone
                    noneLabel="No settlement selected"
                    disabled={settlementOptions.length === 0}
                    options={settlementOptions}
                    onValueChange={(value) =>
                      setRefugeSettlementForSlotAction(
                        slotIndex,
                        value === '__none__' ? '' : value,
                      )
                    }
                  />
                  <p className="text-muted-foreground font-mono text-xs">
                    Choose an existing tracked settlement. Add new settlements in
                    the ledger tab, not from this action.
                  </p>
                  {refugeEntry?.settlementKey && !refugeTargetExists ? (
                    <p className="text-amber-700 font-mono text-xs">
                      Rules warning: this refuge target is not in the settlement
                      ledger.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action.id === 'reduce_danger' ? (
                <div className="space-y-1">
                  <SelectField
                    label="Target settlement"
                    value={
                      reduceDangerTargetExists
                        ? reduceDangerEntry?.settlementKey
                        : undefined
                    }
                    placeholder={
                      settlementOptions.length > 0
                        ? 'Select target settlement'
                        : 'Add tracked settlements in Ledger first'
                    }
                    includeNone
                    noneLabel="No settlement selected"
                    disabled={settlementOptions.length === 0}
                    options={settlementOptions}
                    onValueChange={(value) =>
                      setReduceDangerTargetForSlotAction(
                        slotIndex,
                        value === '__none__' ? '' : value,
                      )
                    }
                  />
                  <p className="text-muted-foreground font-mono text-xs">
                    On success, Reduce Danger applies a temporary +1 reputation
                    shift in a secured target settlement for the upcoming week.
                  </p>
                  {reduceDangerEntry?.settlementKey && !reduceDangerTargetExists ? (
                    <p className="text-amber-700 font-mono text-xs">
                      Rules warning: this Reduce Danger target is not in the
                      settlement ledger.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action.id === 'spread_propaganda' ? (
                <div className="space-y-1">
                  <SelectField
                    label="Target settlement"
                    value={
                      spreadPropagandaTargetExists
                        ? spreadPropagandaEntry?.settlementKey
                        : undefined
                    }
                    placeholder={
                      settlementOptions.length > 0
                        ? 'Select influenced settlement'
                        : 'Add tracked settlements in Ledger first'
                    }
                    includeNone
                    noneLabel="No settlement selected"
                    disabled={settlementOptions.length === 0}
                    options={settlementOptions}
                    onValueChange={(value) =>
                      setSpreadPropagandaTargetForSlotAction(
                        slotIndex,
                        value === '__none__' ? '' : value,
                      )
                    }
                  />
                  <p className="text-muted-foreground font-mono text-xs">
                    Spread Propaganda can improve a tracked settlement by one
                    reputation step on a successful DC 20 Loyalty check.
                  </p>
                  {spreadPropagandaEntry?.settlementKey &&
                  !spreadPropagandaTargetExists ? (
                    <p className="text-amber-700 font-mono text-xs">
                      Rules warning: this Spread Propaganda target is not in the
                      settlement ledger.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {action.id === 'strike_team' ? (
                <div className="space-y-2">
                  <SelectField
                    label="Strike Team mode"
                    value={strikeTeamEntry?.mode ?? undefined}
                    placeholder="Select strike team use"
                    includeNone
                    options={[
                      { value: 'combat_support', label: 'Combat support' },
                      { value: 'extraction', label: 'Casualty extraction' },
                    ]}
                    onValueChange={(value) =>
                      setStrikeTeamForSlotAction({
                        slotIndex,
                        mode:
                          value === '__none__'
                            ? undefined
                            : (value as 'combat_support' | 'extraction'),
                      })
                    }
                  />
                  <TextField
                    label="Target location"
                    value={strikeTeamEntry?.location ?? ''}
                    placeholder="Where is the strike team committed?"
                    onChange={(value) =>
                      setStrikeTeamForSlotAction({
                        slotIndex,
                        location: value,
                      })
                    }
                  />
                  <TextField
                    label="Strike Team notes"
                    value={strikeTeamEntry?.notes ?? ''}
                    placeholder="Optional table note"
                    onChange={(value) =>
                      setStrikeTeamForSlotAction({
                        slotIndex,
                        notes: value,
                      })
                    }
                  />
                  <p className="text-muted-foreground font-mono text-xs">
                    This creates a next-week reminder for either the Specialists&apos;
                    combat-support bonus at the chosen location or the casualty
                    extraction option.
                  </p>
                </div>
              ) : null}

              {action.id === 'secure_cache' ? (
                <div className="space-y-2">
                  <SelectField
                    label="Cache mode"
                    value={cacheEntry?.mode ?? undefined}
                    placeholder="Select place or retrieve"
                    includeNone
                    options={[
                      { value: 'place', label: 'Place cache' },
                      { value: 'retrieve', label: 'Retrieve cache' },
                    ]}
                    onValueChange={(value) =>
                      setCacheOperationForSlotAction({
                        slotIndex,
                        mode:
                          value === '__none__'
                            ? undefined
                            : (value as 'place' | 'retrieve'),
                      })
                    }
                  />

                  {cacheEntry?.mode === 'place' ? (
                    <>
                      <TextField
                        label="Cache label"
                        value={cacheEntry.label ?? ''}
                        placeholder="Describe the cache"
                        onChange={(value) =>
                          setCacheOperationForSlotAction({
                            slotIndex,
                            label: value,
                          })
                        }
                      />
                      <SelectField
                        label="Cache class"
                        value={cacheEntry.cacheClass ?? undefined}
                        placeholder="Select cache class"
                        includeNone
                        options={secureCacheClassOptions}
                        onValueChange={(value) =>
                          setCacheOperationForSlotAction({
                            slotIndex,
                            cacheClass:
                              value === '__none__'
                                ? undefined
                                : (value as 'minor' | 'intermediate' | 'major'),
                          })
                        }
                      />
                      <TextField
                        label="Location"
                        value={cacheEntry.location ?? ''}
                        placeholder="Where is this cache hidden?"
                        onChange={(value) =>
                          setCacheOperationForSlotAction({
                            slotIndex,
                            location: value,
                          })
                        }
                      />
                      <TextField
                        label="Contents"
                        value={cacheEntry.contentsSummary ?? ''}
                        placeholder="Short contents summary"
                        onChange={(value) =>
                          setCacheOperationForSlotAction({
                            slotIndex,
                            contentsSummary: value,
                          })
                        }
                      />
                      <SelectField
                        label="Secure location"
                        value={
                          cacheEntry.isSecureLocation === undefined
                            ? undefined
                            : cacheEntry.isSecureLocation
                              ? 'yes'
                              : 'no'
                        }
                        placeholder="Select location security"
                        includeNone
                        options={secureLocationOptions}
                        onValueChange={(value) =>
                          setCacheOperationForSlotAction({
                            slotIndex,
                            isSecureLocation:
                              value === '__none__' ? undefined : value === 'yes',
                          })
                        }
                      />
                    </>
                  ) : null}

                  {cacheEntry?.mode === 'retrieve' ? (
                    <SelectField
                      label="Cache to retrieve"
                      value={cacheEntry.cacheId ?? undefined}
                      placeholder="Select hidden cache"
                      includeNone
                      options={hiddenCacheOptions}
                      onValueChange={(value) =>
                        setCacheOperationForSlotAction({
                          slotIndex,
                          cacheId: value === '__none__' ? '' : value,
                        })
                      }
                    />
                  ) : null}

                  {secureCacheWarnings.map((warning) => (
                    <p key={warning} className="text-amber-700 font-mono text-xs">
                      Rules warning: {warning}.
                    </p>
                  ))}

                  {cacheEntry?.mode ? (
                    <TextField
                      label="Check total"
                      value={cacheEntry.checkTotal ?? ''}
                      placeholder={cacheCheckPlaceholder}
                      helperText={secureCacheCheckHelperText}
                      onChange={(value) =>
                        setCacheOperationForSlotAction({
                          slotIndex,
                          checkTotal: value,
                        })
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              {action.id === 'special_order' ? (
                <div className="space-y-2">
                  <TextField
                    label="Item or enchantment"
                    value={orderEntry?.description ?? ''}
                    placeholder="Describe the order"
                    onChange={(value) =>
                      setOrderForSlotAction({
                        slotIndex,
                        description: value,
                      })
                    }
                  />
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <TextField
                      label="Cost paid"
                      value={orderEntry?.costPaid ?? ''}
                      placeholder="Enter gp paid"
                      onChange={(value) =>
                        setOrderForSlotAction({
                          slotIndex,
                          costPaid: value,
                        })
                      }
                    />
                    <TextField
                      label="Delivery days"
                      value={orderEntry?.deliveryDays ?? ''}
                      placeholder="Enter delivery days"
                      onChange={(value) =>
                        setOrderForSlotAction({
                          slotIndex,
                          deliveryDays: value,
                        })
                      }
                    />
                  </div>
                  <TextField
                    label="Order notes"
                    value={orderEntry?.notes ?? ''}
                    placeholder="Optional details"
                    onChange={(value) =>
                      setOrderForSlotAction({
                        slotIndex,
                        notes: value,
                      })
                    }
                  />
                </div>
              ) : null}

              {action.id === 'broker_market' || action.id === 'activate_black_market' ? (
                <div className="space-y-2">
                  {marketplaceProfile ? (
                    <p className="text-muted-foreground font-mono text-xs">
                      {action.id === 'activate_black_market'
                        ? `Successful check creates a ${formatMarketplaceAvailabilityTier(marketplaceProfile.availabilityTier).toLowerCase()} black market for 1 week. Use ${marketplaceProfile.availabilityThreshold}% item availability, ${marketplaceProfile.saleValuePercent}% sale value, and allow contraband sales.`
                        : `This creates a temporary ${formatMarketplaceAvailabilityTier(marketplaceProfile.availabilityTier).toLowerCase()} marketplace. Purchased items arrive at the beginning of next Activity phase.`}
                    </p>
                  ) : (
                    <p className="text-amber-700 font-mono text-xs">
                      Rules warning: assign a valid team to determine this marketplace&apos;s profile.
                    </p>
                  )}
                  <TextField
                    label="Marketplace label"
                    value={marketplaceEntry?.label ?? ''}
                    placeholder="Optional custom marketplace label"
                    onChange={(value) =>
                      setMarketplaceForSlotAction({
                        slotIndex,
                        label: value,
                      })
                    }
                  />
                  <TextField
                    label="Purchase summary"
                    value={marketplaceEntry?.purchaseSummary ?? ''}
                    placeholder="Optional items purchased through this market"
                    onChange={(value) =>
                      setMarketplaceForSlotAction({
                        slotIndex,
                        purchaseSummary: value,
                      })
                    }
                  />
                  <TextField
                    label="Marketplace notes"
                    value={marketplaceEntry?.notes ?? ''}
                    placeholder="Optional availability or seller notes"
                    onChange={(value) =>
                      setMarketplaceForSlotAction({
                        slotIndex,
                        notes: value,
                      })
                    }
                  />
                </div>
              ) : null}

              {action.id === 'covert_action' ? (
                <div className="space-y-2">
                  <SelectField
                    label="Covert mode"
                    value={covertEntry?.mode ?? undefined}
                    placeholder="Select covert action mode"
                    includeNone
                    options={[
                      { value: 'augment_action', label: 'Augment next action' },
                      { value: 'place_contact', label: 'Place contact in site' },
                    ]}
                    onValueChange={(value) =>
                      setCovertActionForSlotAction({
                        slotIndex,
                        mode:
                          value === '__none__'
                            ? undefined
                            : (value as 'augment_action' | 'place_contact'),
                      })
                    }
                  />

                  {covertEntry?.mode === 'augment_action' ? (
                    <div className="space-y-1">
                      <p className="text-muted-foreground font-mono text-xs">
                        This applies to the immediately following staged activity.
                        Enter that action&apos;s roll totals manually with the bonus
                        included, and omit Notoriety increase if the augmented
                        action succeeds.
                      </p>
                      {selectedAssignedTeam?.manager ? (
                        <p className="text-muted-foreground font-mono text-xs">
                          Apply {selectedAssignedTeam.manager.displayName} manager
                          CHA bonus{' '}
                          {selectedAssignedTeam.manager.charismaBonus >= 0
                            ? `+${selectedAssignedTeam.manager.charismaBonus}`
                            : selectedAssignedTeam.manager.charismaBonus}{' '}
                          to all d20 rolls for the following action.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {covertEntry?.mode === 'place_contact' ? (
                    <div className="space-y-2">
                      <SelectField
                        label="Contact source"
                        value={covertTargetSource || undefined}
                        placeholder="Select contact source"
                        includeNone
                        noneLabel="No source selected"
                        options={[
                          { value: 'character', label: 'Character ledger' },
                          { value: 'freeform', label: 'Freeform NPC' },
                        ]}
                        onValueChange={(value) => {
                          if (value === '__none__') {
                            setCovertActionForSlotAction({
                              slotIndex,
                              targetSource: undefined,
                              characterId: null,
                              displayName: '',
                              personKind: null,
                            });
                            return;
                          }
                          if (value === 'character') {
                            setCovertActionForSlotAction({
                              slotIndex,
                              targetSource: 'character',
                              characterId: null,
                              displayName: '',
                              personKind: null,
                            });
                            return;
                          }
                          setCovertActionForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            characterId: null,
                          });
                        }}
                      />

                      {covertTargetSource === 'character' ? (
                        <SelectField
                          label="Character"
                          value={covertEntry?.characterId ?? undefined}
                          placeholder="Select character"
                          includeNone
                          options={assignableCharacters.map((character) => ({
                            value: character._id,
                            label: `${character.name} (L${character.level}, ${character.kind})`,
                          }))}
                          onValueChange={(value) =>
                            setCovertActionForSlotAction({
                              slotIndex,
                              targetSource: 'character',
                              characterId:
                                value === '__none__'
                                  ? null
                                  : (value as Id<'character'>),
                            })
                          }
                        />
                      ) : null}

                      {covertTargetSource === 'freeform' ? (
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <TextField
                            label="Contact name"
                            value={covertEntry?.displayName ?? ''}
                            placeholder="Enter contact name"
                            onChange={(value) =>
                              setCovertActionForSlotAction({
                                slotIndex,
                                targetSource: 'freeform',
                                displayName: value,
                              })
                            }
                          />
                          <SelectField
                            label="Contact type"
                            value={covertEntry?.personKind ?? undefined}
                            placeholder="Select contact type"
                            includeNone
                            options={PERSON_KIND_OPTIONS}
                            onValueChange={(value) =>
                              setCovertActionForSlotAction({
                                slotIndex,
                                targetSource: 'freeform',
                                personKind:
                                  value === '__none__'
                                    ? null
                                    : (value as 'pc' | 'officer_npc' | 'other_npc'),
                              })
                            }
                          />
                        </div>
                      ) : null}

                      <TextField
                        label="Adventure site"
                        value={covertEntry?.siteName ?? ''}
                        placeholder="Where is the contact placed?"
                        onChange={(value) =>
                          setCovertActionForSlotAction({
                            slotIndex,
                            siteName: value,
                          })
                        }
                      />
                      <TextField
                        label="Contact notes"
                        value={covertEntry?.notes ?? ''}
                        placeholder="Optional details"
                        onChange={(value) =>
                          setCovertActionForSlotAction({
                            slotIndex,
                            notes: value,
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {action.id === 'manipulate_events' && selectedAssignedTeam?.manager ? (
                <p className="text-muted-foreground font-mono text-xs">
                  {selectedAssignedTeam.manager.displayName} chooses which guaranteed
                  event result to use.
                </p>
              ) : null}

              {action.id === 'rescue_character' ? (
                <div className="space-y-2">
                  <SelectField
                    label="Rescue target source"
                    value={rescueTargetSource || undefined}
                    placeholder="Select rescue target source"
                    includeNone
                    noneLabel="No target selected"
                    options={[
                      { value: 'tracked', label: 'Tracked captured person' },
                      { value: 'character', label: 'Character ledger' },
                      { value: 'freeform', label: 'Freeform NPC' },
                    ]}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        setRescueForSlotAction({
                          slotIndex,
                          targetSource: undefined,
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                          targetLevel: '',
                        });
                        return;
                      }
                      if (value === 'tracked') {
                        setRescueForSlotAction({
                          slotIndex,
                          targetSource: 'tracked',
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                        });
                        return;
                      }
                      if (value === 'character') {
                        setRescueForSlotAction({
                          slotIndex,
                          targetSource: 'character',
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                        });
                        return;
                      }
                      setRescueForSlotAction({
                        slotIndex,
                        targetSource: 'freeform',
                        targetStatusId: '',
                        characterId: null,
                      });
                    }}
                  />

                  {rescueTargetSource === 'tracked' ? (
                    <SelectField
                      label="Captured person"
                      value={rescueEntry?.targetStatusId ?? undefined}
                      placeholder="Select captured person"
                      includeNone
                      options={capturedTrackedPeople}
                      onValueChange={(value) =>
                        setRescueForSlotAction({
                          slotIndex,
                          targetSource: 'tracked',
                          targetStatusId: value === '__none__' ? '' : value,
                        })
                      }
                    />
                  ) : null}

                  {rescueTargetSource === 'character' ? (
                    <SelectField
                      label="Character"
                      value={rescueEntry?.characterId ?? undefined}
                      placeholder="Select character"
                      includeNone
                      options={assignableCharacters.map((character) => ({
                        value: character._id,
                        label: `${character.name} (L${character.level}, ${character.kind})`,
                      }))}
                      onValueChange={(value) =>
                        setRescueForSlotAction({
                          slotIndex,
                          targetSource: 'character',
                          characterId:
                            value === '__none__' ? null : (value as Id<'character'>),
                        })
                      }
                    />
                  ) : null}

                  {rescueTargetSource === 'freeform' ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <TextField
                        label="Target name"
                        value={rescueEntry?.displayName ?? ''}
                        placeholder="Enter captive name"
                        onChange={(value) =>
                          setRescueForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            displayName: value,
                          })
                        }
                      />
                      <SelectField
                        label="Target type"
                        value={rescueEntry?.personKind ?? undefined}
                        placeholder="Select target type"
                        includeNone
                        options={PERSON_KIND_OPTIONS}
                        onValueChange={(value) =>
                          setRescueForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            personKind:
                              value === '__none__'
                                ? null
                                : (value as 'pc' | 'officer_npc' | 'other_npc'),
                          })
                        }
                      />
                      <TextField
                        label="Target level"
                        value={rescueEntry?.targetLevel ?? ''}
                        placeholder="Enter target level"
                        onChange={(value) =>
                          setRescueForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            targetLevel: value,
                          })
                        }
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <SelectField
                      label="Destination"
                      value={rescueEntry?.destinationType ?? undefined}
                      placeholder="Select rescue destination"
                      includeNone
                      options={[
                        { value: 'hq', label: 'Headquarters' },
                        { value: 'refuge', label: 'Activated refuge' },
                        { value: 'settlement', label: 'Operating settlement' },
                      ]}
                      onValueChange={(value) =>
                        setRescueForSlotAction({
                          slotIndex,
                          destinationType:
                            value === '__none__'
                              ? undefined
                              : (value as 'hq' | 'refuge' | 'settlement'),
                        })
                      }
                    />
                    {rescueEntry?.destinationType === 'refuge' ||
                    rescueEntry?.destinationType === 'settlement' ? (
                      <SelectField
                        label={
                          rescueEntry.destinationType === 'refuge'
                            ? 'Destination refuge'
                            : 'Destination settlement'
                        }
                        value={rescueEntry.destinationSettlementKey ?? undefined}
                        placeholder="Select settlement"
                        includeNone
                        options={
                          rescueEntry.destinationType === 'refuge'
                            ? activeRefugeOptions
                            : settlementOptions
                        }
                        onValueChange={(value) =>
                          setRescueForSlotAction({
                            slotIndex,
                            destinationSettlementKey:
                              value === '__none__' ? '' : value,
                          })
                        }
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              {action.id === 'restore_character' ? (
                <div className="space-y-2">
                  <SelectField
                    label="Restore target source"
                    value={restoreTargetSource || undefined}
                    placeholder="Select restoration target source"
                    includeNone
                    noneLabel="No target selected"
                    options={[
                      { value: 'tracked', label: 'Tracked person' },
                      { value: 'character', label: 'Character ledger' },
                      { value: 'freeform', label: 'Freeform NPC' },
                    ]}
                    onValueChange={(value) => {
                      if (value === '__none__') {
                        setRestorationForSlotAction({
                          slotIndex,
                          targetSource: undefined,
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                        });
                        return;
                      }
                      if (value === 'tracked') {
                        setRestorationForSlotAction({
                          slotIndex,
                          targetSource: 'tracked',
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                        });
                        return;
                      }
                      if (value === 'character') {
                        setRestorationForSlotAction({
                          slotIndex,
                          targetSource: 'character',
                          targetStatusId: '',
                          characterId: null,
                          displayName: '',
                          personKind: null,
                        });
                        return;
                      }
                      setRestorationForSlotAction({
                        slotIndex,
                        targetSource: 'freeform',
                        targetStatusId: '',
                        characterId: null,
                      });
                    }}
                  />

                  {restoreTargetSource === 'tracked' ? (
                    <SelectField
                      label="Tracked person"
                      value={restorationEntry?.targetStatusId ?? undefined}
                      placeholder="Select tracked person"
                      includeNone
                      options={restoreTrackedPeople}
                      onValueChange={(value) =>
                        setRestorationForSlotAction({
                          slotIndex,
                          targetSource: 'tracked',
                          targetStatusId: value === '__none__' ? '' : value,
                        })
                      }
                    />
                  ) : null}

                  {restoreTargetSource === 'character' ? (
                    <SelectField
                      label="Character"
                      value={restorationEntry?.characterId ?? undefined}
                      placeholder="Select character"
                      includeNone
                      options={assignableCharacters.map((character) => ({
                        value: character._id,
                        label: `${character.name} (L${character.level}, ${character.kind})`,
                      }))}
                      onValueChange={(value) =>
                        setRestorationForSlotAction({
                          slotIndex,
                          targetSource: 'character',
                          characterId:
                            value === '__none__' ? null : (value as Id<'character'>),
                        })
                      }
                    />
                  ) : null}

                  {restoreTargetSource === 'freeform' ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <TextField
                        label="Target name"
                        value={restorationEntry?.displayName ?? ''}
                        placeholder="Enter target name"
                        onChange={(value) =>
                          setRestorationForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            displayName: value,
                          })
                        }
                      />
                      <SelectField
                        label="Target type"
                        value={restorationEntry?.personKind ?? undefined}
                        placeholder="Select target type"
                        includeNone
                        options={PERSON_KIND_OPTIONS}
                        onValueChange={(value) =>
                          setRestorationForSlotAction({
                            slotIndex,
                            targetSource: 'freeform',
                            personKind:
                              value === '__none__'
                                ? null
                                : (value as 'pc' | 'officer_npc' | 'other_npc'),
                          })
                        }
                      />
                    </div>
                  ) : null}

                  <SelectField
                    label="Restorative mode"
                    value={restorationEntry?.mode ?? undefined}
                    placeholder="Select restorative effect"
                    includeNone
                    options={RESTORE_MODE_OPTIONS}
                    onValueChange={(value) =>
                      setRestorationForSlotAction({
                        slotIndex,
                        mode:
                          value === '__none__'
                            ? undefined
                            : (value as
                                | 'party_ability_damage'
                                | 'party_hit_points'
                                | 'party_lesser_restorative'
                                | 'break_enchantment'
                                | 'raise_dead'
                                | 'restoration'
                                | 'stone_to_flesh'
                                | 'custom'),
                      })
                    }
                  />
                  <p className="text-muted-foreground font-mono text-xs">
                    {getRestoreModeHelper(restorationEntry?.mode)}
                  </p>
                  {restorationEntry?.mode === 'custom' ? (
                    <TextField
                      label="Custom cost total"
                      value={restorationEntry?.customCostTotal ?? ''}
                      placeholder="Enter custom treasury cost"
                      onChange={(value) =>
                        setRestorationForSlotAction({
                          slotIndex,
                          customCostTotal: value,
                        })
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              <p className="text-muted-foreground font-mono text-xs">
                Drag this card out of slot to unstage.
              </p>
            </div>
          </Card>
        </div>
      ) : (
        <p className="text-muted-foreground mt-1 font-mono text-xs">
          {dragState && isActiveDropSlot
            ? 'Release to stage this action'
            : 'Drag an activity card here'}
        </p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  helperText,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  helperText?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="font-mono"
      />
      {helperText ? (
        <p className="text-muted-foreground font-mono text-xs">{helperText}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  includeNone = false,
  noneLabel = 'None',
  disabled = false,
}: {
  label: string;
  value?: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  includeNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="border-primary bg-card w-full border-2 font-mono">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="border-primary bg-card border-2 font-mono">
          {includeNone ? <SelectItem value="__none__">{noneLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const PERSON_KIND_OPTIONS = [
  { value: 'pc', label: 'PC' },
  { value: 'officer_npc', label: 'Officer NPC' },
  { value: 'other_npc', label: 'Other NPC' },
];

const RESTORE_MODE_OPTIONS = [
  { value: 'party_ability_damage', label: 'Heal all ability damage' },
  { value: 'party_hit_points', label: 'Heal all hit point damage' },
  { value: 'party_lesser_restorative', label: 'Party 3rd-level restorative' },
  { value: 'break_enchantment', label: 'Break enchantment (1,125 gp)' },
  { value: 'raise_dead', label: 'Raise dead (6,125 gp)' },
  { value: 'restoration', label: 'Restoration (1,700 gp)' },
  { value: 'stone_to_flesh', label: 'Stone to flesh (1,650 gp)' },
  { value: 'custom', label: 'Custom restorative cost' },
];

function getTargetSource({
  explicitSource,
  targetStatusId,
  characterId,
  displayName,
}: {
  explicitSource?: 'tracked' | 'character' | 'freeform';
  targetStatusId?: string;
  characterId?: string;
  displayName?: string;
}) {
  if (explicitSource) {
    return explicitSource;
  }
  if (targetStatusId) {
    return 'tracked';
  }
  if (characterId) {
    return 'character';
  }
  if ((displayName ?? '').trim()) {
    return 'freeform';
  }
  return '';
}

function buildTrackedPersonLabel(person: TrackedPersonLedgerEntry) {
  const levelLabel = person.level !== undefined ? `L${person.level}` : 'No level';
  return `${person.displayName} (${person.status}, ${levelLabel})`;
}

function getRestoreModeHelper(
  mode:
    | 'party_ability_damage'
    | 'party_hit_points'
    | 'party_lesser_restorative'
    | 'break_enchantment'
    | 'raise_dead'
    | 'restoration'
    | 'stone_to_flesh'
    | 'custom'
    | undefined,
) {
  if (mode === 'break_enchantment') {
    return 'Prefilled scroll-equivalent cost: 1,125 gp.';
  }
  if (mode === 'raise_dead') {
    return 'Prefilled scroll-equivalent cost: 6,125 gp.';
  }
  if (mode === 'restoration') {
    return 'Prefilled scroll-equivalent cost: 1,700 gp.';
  }
  if (mode === 'stone_to_flesh') {
    return 'Prefilled scroll-equivalent cost: 1,650 gp.';
  }
  if (mode === 'custom') {
    return 'Enter the custom treasury cost below.';
  }
  if (mode) {
    return 'This party-scale restorative option does not require extra treasury by default.';
  }
  return 'Choose the restorative effect that will be applied during week resolution.';
}

function getOfficerAssignmentName(
  role: OfficerRole,
  officerAssignments: OfficerAssignments,
  assignableCharacters: AssignableCharacter[],
) {
  const currentCharacterId = officerAssignments[role];
  if (!currentCharacterId) {
    return 'Unassigned';
  }
  return (
    assignableCharacters.find((character) => character._id === currentCharacterId)?.name ??
    'Assigned'
  );
}

function getSlotContainerClassName({
  hasAction,
  isActiveDropSlot,
  isDraggingFromThisSlot,
}: {
  hasAction: boolean;
  isActiveDropSlot: boolean;
  isDraggingFromThisSlot: boolean;
}) {
  if (isDraggingFromThisSlot) {
    return 'bg-primary/5 min-h-28 border-2 border-transparent p-2 transition-all';
  }
  if (isActiveDropSlot) {
    return 'border-primary bg-primary/10 ring-primary/40 min-h-28 border-2 border-dashed p-2 ring-2 transition-all';
  }
  if (hasAction) {
    return 'border-primary/40 bg-primary/5 min-h-28 border-2 border-dashed p-2 transition-all';
  }
  return 'border-primary/25 bg-primary/5 min-h-28 border-2 border-dashed p-2 transition-all';
}

function getSlotCardClassName(isDraggingFromThisSlot: boolean) {
  if (isDraggingFromThisSlot) {
    return 'border-primary bg-card cursor-grabbing border-2 border-solid p-2 shadow-2xl transition-none select-none';
  }
  return 'border-primary/50 bg-card cursor-grab border p-2 transition-all active:cursor-grabbing';
}

function getDraggingSlotCardStyle(dragState: DragState | null) {
  const baseStyle = getPointerCardDragStyle(dragState);
  if (!baseStyle) return undefined;
  return {
    ...baseStyle,
    opacity: 1,
    backdropFilter: 'none',
  };
}
