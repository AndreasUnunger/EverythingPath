'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { api as db } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { characterLedgerQuery, militiaQuery } from '~/lib/sharedQueries';
import { TeamManagerFormCard } from './team-manager/team-manager-form-card';
import { TeamListCard } from './team-manager/team-list-card';
import {
  defaultTeamManagerFormValues,
  teamManagerFormSchema,
  type TeamManagerFormValues,
  type TeamRecord,
} from './team-manager/types';

export function TeamManager({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [editingTeam, setEditingTeam] = useState<TeamRecord | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [mutationWarnings, setMutationWarnings] = useState<string[]>([]);
  const [pendingTeamId, setPendingTeamId] = useState<string>();

  const form = useForm<TeamManagerFormValues>({
    resolver: zodResolver(teamManagerFormSchema),
    defaultValues: defaultTeamManagerFormValues,
  });

  const { data: militia, isLoading } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );
  const { data: characters = [] } = characterLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
    false,
  );

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
        Checking organization access...
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

  function closeForm() {
    setIsFormOpen(false);
    setEditingTeam(undefined);
    setFormError(undefined);
    form.reset(defaultTeamManagerFormValues);
  }

  function startEdit(team: TeamRecord) {
    setEditingTeam(team);
    setFormError(undefined);
    setMutationWarnings(team.manager?.warnings ?? []);
    form.reset({
      managerSource: team.managerSource ?? 'none',
      managerCharacterId: team.managerCharacterId ?? '',
      managerName: team.managerName ?? '',
      managerKind: team.managerKind ?? 'other_npc',
      managerCharisma: String(team.managerCharisma ?? 10),
    });
    setIsFormOpen(true);
  }

  async function submitForm(values: TeamManagerFormValues) {
    if (!militia || !editingTeam) {
      return;
    }

    setFormError(undefined);
    setPendingTeamId(editingTeam.id);

    try {
      const result = await assignTeamManager({
        organizationId,
        militiaId: militia._id,
        teamId: editingTeam.id as never,
        managerSource:
          values.managerSource === 'none' ? undefined : values.managerSource,
        managerCharacterId:
          values.managerSource === 'character' && values.managerCharacterId
            ? (values.managerCharacterId as never)
            : undefined,
        managerName:
          values.managerSource === 'freeform'
            ? values.managerName.trim()
            : undefined,
        managerKind:
          values.managerSource === 'freeform' ? values.managerKind : undefined,
        managerCharisma:
          values.managerSource === 'freeform'
            ? Number(values.managerCharisma)
            : undefined,
      });

      setMutationWarnings(result.warnings.map((warning) => warning.message));
      closeForm();
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save team manager.'));
    } finally {
      setPendingTeamId(undefined);
    }
  }

  const assignableCharacters = characters.filter(
    (character) =>
      character.isActive !== false &&
      ((character.kind ?? 'pc') === 'pc' || (character.kind ?? 'pc') === 'officer_npc'),
  );
  const managedTeams = militia.teams.filter((team) => team.manager).length;

  return (
    <div className="space-y-4">
      <div className="bg-card flex items-center justify-between border-2 border-b-0 p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Team Ledger
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {militia.teams.length} team{militia.teams.length === 1 ? '' : 's'} in
            roster • {managedTeams} manager{managedTeams === 1 ? '' : 's'} assigned
          </p>
          <p className="text-muted-foreground mt-1 font-mono text-xs">
            Track team managers here so team action bonuses and manager limits stay visible during play.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const firstTeamWithoutManager = militia.teams.find((team) => !team.manager);
            if (firstTeamWithoutManager) {
              startEdit(firstTeamWithoutManager);
            }
          }}
          disabled={!militia.teams.some((team) => !team.manager)}
        >
          Assign Manager
        </Button>
      </div>

      {mutationWarnings.length ? (
        <div className="border-primary/40 bg-primary/10 space-y-1 border p-3">
          {mutationWarnings.map((warning) => (
            <p key={warning} className="font-mono text-xs">
              {warning}
            </p>
          ))}
        </div>
      ) : null}

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
        <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl">
              {editingTeam ? `Edit Manager: ${editingTeam.name}` : 'Edit Team Manager'}
            </DialogTitle>
            <DialogDescription className="font-mono text-sm">
              Linked characters use their ledger Charisma. Freeform managers let you model existing campaign NPCs directly.
            </DialogDescription>
          </DialogHeader>

          <TeamManagerFormCard
            form={form}
            characters={assignableCharacters}
            onSubmit={submitForm}
            onCancel={closeForm}
            submitError={formError}
          />
        </DialogContent>
      </Dialog>

      <TeamListCard
        teams={militia.teams}
        pendingTeamId={pendingTeamId}
        onEdit={startEdit}
      />
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
