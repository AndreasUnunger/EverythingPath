'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  LedgerTable,
  LedgerTableActionCell,
  LedgerTableBody,
  LedgerTableCell,
  LedgerTableHead,
  LedgerTableHeaderCell,
  LedgerTableRow,
} from '~/components/ledger-table';
import { LedgerShell } from '~/components/ledger-shell';
import { TeamStateFormCard } from '~/components/militia-state-manager/form-cards';
import {
  defaultTeamStateFormValues,
  teamStateFormSchema,
  type TeamStateFormValues,
} from '~/components/militia-state-manager/types';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import {
  formatTeamStatusLabel,
  formatTrackedPersonKindLabel,
} from '~/lib/militia-state-options';
import { characterLedgerQuery, militiaQuery } from '~/lib/sharedQueries';

export function TeamLedger({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string>();

  const form = useForm<TeamStateFormValues>({
    resolver: zodResolver(teamStateFormSchema),
    defaultValues: defaultTeamStateFormValues,
  });

  const { data: militia, isLoading } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: characters } = characterLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery && Boolean(militia),
    true,
  );

  const upsertMilitiaTeamState = useMutation(db.militia.upsertMilitiaTeamState);
  const assignTeamManager = useMutation(db.militia.assignTeamManager);

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to manage teams.
      </p>
    );
  }

  if (!canQuery) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Waiting for organization access sync...
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Loading militia...
      </p>
    );
  }

  if (!militia) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Create a militia to manage teams.
      </p>
    );
  }

  const currentMilitia = militia;

  const characterOptions =
    characters?.map((character) => ({
      _id: character._id,
      name: character.name,
      kind: character.kind,
      level: character.level,
      charisma: character.charisma,
    })) ?? [];

  function closeForm() {
    setEditingTeamId(undefined);
    setFormError(undefined);
    setIsFormOpen(false);
    form.reset(defaultTeamStateFormValues);
  }

  function openTeamEditor(teamId?: string) {
    const existing = currentMilitia.teams.find((team) => team.id === teamId);
    form.reset(
      existing
        ? {
            teamId: existing.id as TeamStateFormValues['teamId'],
            status: existing.status ?? 'active',
            unavailableUntilWeek:
              existing.unavailableUntilWeek !== undefined
                ? String(existing.unavailableUntilWeek)
                : '',
            notes: existing.notes ?? '',
            managerSource: existing.managerSource ?? 'none',
            managerCharacterId: existing.managerCharacterId ?? '',
            managerName: existing.managerName ?? '',
            managerKind: existing.managerKind ?? 'other_npc',
            managerCharisma:
              existing.managerCharisma !== undefined
                ? String(existing.managerCharisma)
                : '',
          }
        : defaultTeamStateFormValues,
    );
    setEditingTeamId(teamId);
    setFormError(undefined);
    setIsFormOpen(true);
  }

  async function submitTeam(values: TeamStateFormValues) {
    try {
      await upsertMilitiaTeamState({
        organizationId,
        militiaId: currentMilitia._id,
        teamId: values.teamId,
        inRoster: true,
        status: values.status,
        unavailableUntilWeek: values.unavailableUntilWeek.trim()
          ? Number(values.unavailableUntilWeek)
          : undefined,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      });
      await assignTeamManager({
        organizationId,
        militiaId: currentMilitia._id,
        teamId: values.teamId,
        managerSource:
          values.managerSource === 'none' ? undefined : values.managerSource,
        managerCharacterId:
          values.managerSource === 'character' && values.managerCharacterId
            ? (values.managerCharacterId as Id<'character'>)
            : undefined,
        managerName:
          values.managerSource === 'freeform'
            ? values.managerName.trim()
            : undefined,
        managerKind:
          values.managerSource === 'freeform' ? values.managerKind : undefined,
        managerCharisma:
          values.managerSource === 'freeform' && values.managerCharisma.trim()
            ? Number(values.managerCharisma)
            : undefined,
      });
      closeForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save team.'));
    }
  }

  async function removeTeam(teamId: string) {
    const deleteKey = `team:${teamId}`;
    setPendingDeleteKey(deleteKey);
    try {
      await upsertMilitiaTeamState({
        organizationId,
        militiaId: currentMilitia._id,
        teamId: teamId as Parameters<typeof upsertMilitiaTeamState>[0]['teamId'],
        inRoster: false,
        status: 'active',
      });
    } finally {
      setPendingDeleteKey(undefined);
    }
  }

  function toggleLedger() {
    if (isOpen) {
      closeForm();
    }
    setIsOpen((prev) => !prev);
  }

  return (
    <LedgerShell
      title="Team Ledger"
      meta={`${currentMilitia.teams.length} team${currentMilitia.teams.length === 1 ? '' : 's'} in roster`}
      isOpen={isOpen}
      onToggle={toggleLedger}
      actions={
        isOpen ? (
          <Button
            type="button"
            onClick={() => openTeamEditor()}
            className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
          >
            Add Team
          </Button>
        ) : null
      }
    >
      <>
          {currentMilitia.teams.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm">
              No roster teams tracked yet.
            </p>
          ) : (
            <LedgerTable>
                <colgroup>
                  <col style={{ width: '20%' }} />
                  <col />
                  <col />
                  <col />
                  <col style={{ width: '11rem' }} />
                </colgroup>
                <LedgerTableHead>
                  <tr className="border-b border-primary/8">
                    <LedgerTableHeaderCell>
                      Team
                    </LedgerTableHeaderCell>
                    <LedgerTableHeaderCell>
                      Status
                    </LedgerTableHeaderCell>
                    <LedgerTableHeaderCell>
                      Roster
                    </LedgerTableHeaderCell>
                    <LedgerTableHeaderCell>
                      Manager
                    </LedgerTableHeaderCell>
                    <LedgerTableHeaderCell className="w-[11rem]" />
                  </tr>
                </LedgerTableHead>
                <LedgerTableBody>
                  {currentMilitia.teams.map((team, index) => (
                    <LedgerTableRow key={team.id} index={index}>
                      <LedgerTableCell>
                        <div className="space-y-1">
                          <p className="font-sans text-lg font-bold">{team.name}</p>
                          {team.notes ? (
                            <p className="text-muted-foreground font-mono text-sm">
                              Notes: {team.notes}
                            </p>
                          ) : null}
                        </div>
                      </LedgerTableCell>
                      <LedgerTableCell>
                        <div className="space-y-1">
                          <p className="font-mono text-sm">
                            {formatTeamStatusLabel(team.status ?? 'active')}
                          </p>
                          <p className="text-muted-foreground font-mono text-sm">
                            Unavailable until week: {team.unavailableUntilWeek ?? 'None'}
                          </p>
                        </div>
                      </LedgerTableCell>
                      <LedgerTableCell>
                        <p className="text-muted-foreground font-mono text-sm">
                          {team.type} tier {team.tier} • {team.size} troops
                        </p>
                      </LedgerTableCell>
                      <LedgerTableCell>
                        <div className="space-y-1">
                          <p className="text-muted-foreground font-mono text-sm">
                            {team.manager
                              ? `${team.manager.displayName} • ${formatTrackedPersonKindLabel(team.manager.kind)} • CHA ${team.manager.charisma}`
                              : 'None'}
                          </p>
                          {team.manager?.warnings.map((warning) => (
                            <p
                              key={warning}
                              className="text-muted-foreground font-mono text-sm"
                            >
                              Warning: {warning}
                            </p>
                          ))}
                        </div>
                      </LedgerTableCell>
                      <LedgerTableActionCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openTeamEditor(team.id)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void removeTeam(team.id)}
                          disabled={pendingDeleteKey === `team:${team.id}`}
                        >
                          {pendingDeleteKey === `team:${team.id}`
                            ? 'Deleting...'
                            : 'Delete'}
                        </Button>
                      </LedgerTableActionCell>
                    </LedgerTableRow>
                  ))}
                </LedgerTableBody>
            </LedgerTable>
          )}

          <Dialog
            open={isFormOpen}
            onOpenChange={(open) => {
              if (open) {
                setIsFormOpen(true);
                return;
              }
              closeForm();
            }}
          >
            <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle className="font-sans text-xl">
                  {editingTeamId ? 'Edit Team' : 'Add Team'}
                </DialogTitle>
                <DialogDescription className="font-mono text-sm">
                  Keep roster state and manager assignment together for mid-campaign setup and corrections.
                </DialogDescription>
              </DialogHeader>
              <TeamStateFormCard
                form={form}
                onSubmit={submitTeam}
                onCancel={closeForm}
                submitError={formError}
                characterOptions={characterOptions.filter(
                  (character) =>
                    (character.kind ?? 'pc') === 'pc' ||
                    (character.kind ?? 'pc') === 'officer_npc',
                )}
              />
            </DialogContent>
          </Dialog>
      </>
    </LedgerShell>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
}
