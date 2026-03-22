'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { ActivityRollsController } from '~/components/week-board/activity-rolls-controller';
import { ActivityDeckCard } from '~/components/week-board/phase-sections/activity-deck-card';
import {
  buildActivityActionEntries,
  type ActivityActionCardEntry,
  type ActivityPhaseViewModel,
} from '~/components/week-board/phase-sections/activity-phase-shared';
import { ActivitySlotCard } from '~/components/week-board/phase-sections/activity-slot-card';

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
    organizationId,
    rank,
    treasury,
    maxTeams,
    stagedActionIds,
    serverActivityTotals,
    slotTeams,
    activityTeamOperations,
    activityOfficerOperations,
    assignableCharacters,
    officerAssignments,
    teams,
    activeTeamIds,
    setSlotTeamAction,
    setRecruitTeamForSlotAction,
    setDismissTeamForSlotAction,
    setUpgradeTeamsForSlotAction,
    setOfficerChangeForSlotAction,
    onErrorAction,
  } = viewModel;

  const actionCards = buildActivityActionEntries({
    dragState,
    assignedActionIds,
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

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,40%)] xl:items-start">
      <div className="order-2 max-h-[calc(100vh-18rem)] min-h-0 overflow-y-auto border p-2 xl:order-1">
        <div className="space-y-4">
          <ActionDeckSection
            title="Legal Actions"
            entries={legalActionCards}
            dragState={dragState}
            onDragStart={(event, entry) =>
              handleDeckCardDragStart({
                event,
                entry,
                onErrorAction,
                setDragStateAction,
              })
            }
          />
          <ActionDeckSection
            title="Other Actions"
            entries={otherActionCards}
            dragState={dragState}
            onDragStart={(event, entry) =>
              handleDeckCardDragStart({
                event,
                entry,
                onErrorAction,
                setDragStateAction,
              })
            }
          />
        </div>
      </div>

      <Card className="order-1 max-h-[calc(100vh-18rem)] overflow-y-auto border p-3 xl:sticky xl:top-4 xl:order-2">
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
                teams={teams}
                activeTeamIds={activeTeamIds}
                assignableCharacters={assignableCharacters}
                officerAssignments={officerAssignments}
                maxTeams={maxTeams}
                treasury={treasury}
                setDragStateAction={setDragStateAction}
                setSlotTeamAction={setSlotTeamAction}
                setRecruitTeamForSlotAction={setRecruitTeamForSlotAction}
                setDismissTeamForSlotAction={setDismissTeamForSlotAction}
                setUpgradeTeamsForSlotAction={setUpgradeTeamsForSlotAction}
                setOfficerChangeForSlotAction={setOfficerChangeForSlotAction}
              />
            ))}
          </div>

          <div>
            <ActivityRollsController
              militiaId={militiaId}
              organizationId={organizationId}
              rank={rank}
              stagedActionIds={stagedActionIds}
              serverTotals={serverActivityTotals}
              onErrorAction={onErrorAction}
              className="space-y-2"
              showTitle={false}
            />
          </div>
        </div>
      </Card>
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
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  setDragStateAction({
    actionId: entry.card.id,
    source: 'deck',
    sourceSlotIndex: undefined,
    pointerX: event.clientX,
    pointerY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    width: rect.width,
    height: rect.height,
  });
}
