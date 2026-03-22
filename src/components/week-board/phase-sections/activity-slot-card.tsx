'use client';

import type { Id } from '@convex/_generated/dataModel';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Card } from '~/components/ui/card';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ACTION_CARDS } from '~/components/week-board/data';
import {
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
import type { ActionId, DragState } from '~/components/week-board/types';

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
  teams: Array<{
    teamId: string;
    status: 'active' | 'disabled' | 'missing' | 'blocked';
  }>;
  activeTeamIds: string[];
  assignableCharacters: AssignableCharacter[];
  officerAssignments: OfficerAssignments;
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
  teams,
  activeTeamIds,
  assignableCharacters,
  officerAssignments,
  maxTeams,
  treasury,
  setDragStateAction,
  setSlotTeamAction,
  setRecruitTeamForSlotAction,
  setDismissTeamForSlotAction,
  setUpgradeTeamsForSlotAction,
  setOfficerChangeForSlotAction,
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
              const target = event.target as HTMLElement;
              if (
                target.closest(
                  'button, input, select, textarea, [role="combobox"], [role="listbox"], [data-radix-select-trigger]',
                )
              ) {
                return;
              }
              event.preventDefault();
              const element = event.currentTarget as HTMLDivElement;
              const rect = element.getBoundingClientRect();
              setDragStateAction({
                actionId: action.id,
                source: 'slot',
                sourceSlotIndex: slotIndex,
                pointerX: event.clientX,
                pointerY: event.clientY,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top,
                width: rect.width,
                height: rect.height,
              });
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
                <SelectField
                  label="Assigned team"
                  value={assignedTeamId || undefined}
                  placeholder="Select team for this slot"
                  options={activeTeamIds.map((teamId) => ({
                    value: teamId,
                    label: teamId,
                  }))}
                  onValueChange={(value) =>
                    setSlotTeamAction(slotIndex, value ? value : null)
                  }
                />
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
                    placeholder="Select character"
                    noneLabel="Unassign"
                    includeNone
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

function SelectField({
  label,
  value,
  placeholder,
  options,
  onValueChange,
  includeNone = false,
  noneLabel = 'None',
}: {
  label: string;
  value?: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
  includeNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs">{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
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
  if (!dragState) return undefined;
  return {
    position: 'fixed' as const,
    left: dragState.pointerX - dragState.offsetX,
    top: dragState.pointerY - dragState.offsetY,
    width: dragState.width,
    zIndex: 9999,
    pointerEvents: 'none' as const,
    touchAction: 'none' as const,
    isolation: 'isolate' as const,
    backgroundColor: 'var(--card)',
    opacity: 1,
    backdropFilter: 'none',
    WebkitUserSelect: 'none' as const,
  };
}
