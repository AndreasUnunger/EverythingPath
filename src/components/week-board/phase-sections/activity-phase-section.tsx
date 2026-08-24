'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ActivityRollsController } from '~/components/week-board/activity-rolls-controller';
import { AssetLedgerPanel } from '~/components/week-board/asset-ledger-panel';
import { ActivityDeckCard } from '~/components/week-board/phase-sections/activity-deck-card';
import {
  buildActivityActionEntries,
  type ActivityActionCardEntry,
  type ActivityPhaseViewModel,
} from '~/components/week-board/phase-sections/activity-phase-shared';
import { ActivitySlotCard } from '~/components/week-board/phase-sections/activity-slot-card';
import { createPointerCardDragState } from '~/lib/pointer-card-drag';

export type { ActivityPhaseViewModel } from '~/components/week-board/phase-sections/activity-phase-shared';

export function ActivityPhaseSection({
  viewModel,
}: {
  viewModel: ActivityPhaseViewModel;
}) {
  const {
    dragState,
    setDragStateAction,
    assignedActionIds,
    hasNonLieLowStaged,
    hasLieLowStaged,
    slotRows,
    activeDropSlotId,
    slotRefs,
    resetSlotsAction,
    militiaId,
    rank,
    treasury,
    maxTeams,
    stagedActionIds,
    serverActivityTotals,
    slotTeams,
    activityTeamOperations,
    activityOfficerOperations,
    activityAssetOperations,
    assignableCharacters,
    officerAssignments,
    officerEffects,
    strategistBonusActionId,
    teams,
    settlements,
    caches,
    marketplaces,
    orders,
    trackedPeople,
    activeTeamIds,
    queueActivityRollTotalsPatchAction,
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
    onErrorAction,
  } = viewModel;

  const actionCards = buildActivityActionEntries({
    dragState,
    assignedActionIds,
    stagedActionIds,
    hasNonLieLowStaged,
    hasLieLowStaged,
    rank,
    treasury,
    maxTeams,
    teams,
    activeTeamIds,
  });
  const legalActionCards = actionCards.filter((entry) => entry.isLegal);
  const otherActionCards = actionCards.filter((entry) => !entry.isLegal);
  const handleDeckCardDragStartAction = (
    event: ReactPointerEvent<HTMLDivElement>,
    entry: ActivityActionCardEntry,
  ) => {
    handleDeckCardDragStart({
      event,
      entry,
      onErrorAction,
      setDragStateAction,
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,40%)] xl:items-start">
      <div className="order-2 max-h-[calc(100vh-18rem)] min-h-0 overflow-y-auto border p-2 xl:order-1">
        <div className="space-y-4">
          <ActionDeckSection
            title="Legal Actions"
            entries={legalActionCards}
            dragState={dragState}
            onDragStart={handleDeckCardDragStartAction}
          />
          <ActionDeckSection
            title="Other Actions"
            entries={otherActionCards}
            dragState={dragState}
            onDragStart={handleDeckCardDragStartAction}
          />
        </div>
      </div>

      <div className="order-1 space-y-3 xl:order-2">
        <Card className="max-h-[calc(100vh-18rem)] overflow-y-auto border p-3 xl:sticky xl:top-4">
          <div className="mb-1 grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm font-bold">
                Activity Slots ({slotRows.length} max)
              </p>
              <Button variant="outline" onClick={resetSlotsAction}>
                Reset Slots
              </Button>
            </div>
            <p className="font-mono text-sm font-bold">Activity Roll Entry</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              {slotRows.map((slotRow) => (
                <ActivitySlotCard
                  key={slotRow.slotId}
                  slotId={slotRow.slotId}
                  slotNumber={slotRow.slotNumber}
                  slotActionId={slotRow.slotActionId}
                  dragState={dragState}
                  activeDropSlotId={activeDropSlotId}
                  slotRefs={slotRefs}
                  slotTeams={slotTeams}
                  activityTeamOperations={activityTeamOperations}
                  activityOfficerOperations={activityOfficerOperations}
                  activityAssetOperations={activityAssetOperations}
                  teams={teams}
                  settlements={settlements}
                  caches={caches}
                  marketplaces={marketplaces}
                  orders={orders}
                  trackedPeople={trackedPeople}
                  activeTeamIds={activeTeamIds}
                  assignableCharacters={assignableCharacters}
                  officerAssignments={officerAssignments}
                  officerEffects={officerEffects}
                  strategistBonusActionId={strategistBonusActionId}
                  maxTeams={maxTeams}
                  treasury={treasury}
                  setDragStateAction={setDragStateAction}
                  setSlotTeamAction={setSlotTeamAction}
                  setRecruitTeamForSlotAction={setRecruitTeamForSlotAction}
                  setDismissTeamForSlotAction={setDismissTeamForSlotAction}
                  setUpgradeTeamsForSlotAction={setUpgradeTeamsForSlotAction}
                  setOfficerChangeForSlotAction={setOfficerChangeForSlotAction}
                  setRefugeSettlementForSlotAction={setRefugeSettlementForSlotAction}
                  setReduceDangerTargetForSlotAction={
                    setReduceDangerTargetForSlotAction
                  }
                  setSpreadPropagandaTargetForSlotAction={
                    setSpreadPropagandaTargetForSlotAction
                  }
                  setStrikeTeamForSlotAction={setStrikeTeamForSlotAction}
                  setCacheOperationForSlotAction={setCacheOperationForSlotAction}
                  setOrderForSlotAction={setOrderForSlotAction}
                  setMarketplaceForSlotAction={setMarketplaceForSlotAction}
                  setCovertActionForSlotAction={setCovertActionForSlotAction}
                  setRescueForSlotAction={setRescueForSlotAction}
                  setRestorationForSlotAction={setRestorationForSlotAction}
                />
              ))}
            </div>

            <div>
              <ActivityRollsController
                militiaId={militiaId}
                rank={rank}
                stagedActionIds={stagedActionIds}
                serverTotals={serverActivityTotals}
                officerEffects={officerEffects}
                strategistBonusActionId={strategistBonusActionId}
                recruitTeamId={activityTeamOperations.recruits[0]?.teamId}
                slotTeams={slotTeams}
                teams={teams}
                queueActivityRollTotalsPatchAction={
                  queueActivityRollTotalsPatchAction
                }
                onErrorAction={onErrorAction}
                className="space-y-2"
                showTitle={false}
              />
            </div>
          </div>
        </Card>

        <AssetLedgerPanel
          settlements={settlements}
          caches={caches}
          marketplaces={marketplaces}
          orders={orders}
          trackedPeople={trackedPeople}
          stickyOnWide={false}
        />
      </div>
    </div>
  );
}

function ActionDeckSection({
  title,
  entries,
  dragState,
  onDragStart,
}: {
  title: string;
  entries: ActivityActionCardEntry[];
  dragState: ActivityPhaseViewModel['dragState'];
  onDragStart: (
    event: ReactPointerEvent<HTMLDivElement>,
    entry: ActivityActionCardEntry,
  ) => void;
}) {
  return (
    <section className="space-y-2">
      <p className="font-mono text-sm font-bold">{title}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {entries.map((entry) => (
          <ActivityDeckCard
            key={entry.card.id}
            entry={entry}
            dragState={dragState}
            onDragStart={onDragStart}
          />
        ))}
      </div>
    </section>
  );
}

function handleDeckCardDragStart({
  event,
  entry,
  onErrorAction,
  setDragStateAction,
}: {
  event: ReactPointerEvent<HTMLDivElement>;
  entry: ActivityActionCardEntry;
  onErrorAction: (message: string) => void;
  setDragStateAction: ActivityPhaseViewModel['setDragStateAction'];
}) {
  if (entry.isDisabled) {
    return;
  }
  if (!entry.isLegal) {
    onErrorAction(
      entry.warnings[0] ??
        'Rules warning: this action is outside recommended constraints.',
    );
  }
  event.preventDefault();
  setDragStateAction(
    createPointerCardDragState({
      event,
      actionId: entry.card.id,
      source: 'deck',
    }),
  );
}
