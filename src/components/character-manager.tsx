'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { characterLedgerQuery, militiaQuery } from '~/lib/sharedQueries';
import { ArchivedCharactersCard } from './character-manager/archived-characters-card';
import { CharacterFormCard } from './character-manager/character-form-card';
import { CharacterListCard } from './character-manager/character-list-card';
import { OfficerAssignmentsCard } from './character-manager/officer-assignments-card';
import {
  characterFormSchema,
  defaultCharacterFormValues,
  type CharacterFormValues,
  type CharacterId,
  type CharacterRecord,
  type OfficerRole,
} from './character-manager/types';

export function CharacterManager({
  selectedCampaignId,
  organizationId,
  canQuery,
}: {
  selectedCampaignId: Id<'campaign'> | undefined;
  organizationId: string;
  canQuery: boolean;
}) {
  const [editingId, setEditingId] = useState<Id<'character'> | undefined>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignmentWarnings, setAssignmentWarnings] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [assignmentError, setAssignmentError] = useState<string>();
  const [archiveError, setArchiveError] = useState<string>();
  const [pendingOfficerRole, setPendingOfficerRole] = useState<
    OfficerRole | undefined
  >();
  const [pendingArchiveId, setPendingArchiveId] = useState<
    Id<'character'> | undefined
  >();
  const [pendingDeleteId, setPendingDeleteId] = useState<Id<'character'> | undefined>();
  const [deleteCandidate, setDeleteCandidate] = useState<
    CharacterRecord | undefined
  >();

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: defaultCharacterFormValues,
  });

  const { data: characters = [], isLoading } = characterLedgerQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
    true,
  );
  const { data: militia } = militiaQuery(
    selectedCampaignId,
    organizationId,
    canQuery,
  );

  const createCharacter = useMutation(db.character.createCharacter);
  const updateCharacter = useMutation(db.character.updateCharacter);
  const archiveCharacter = useMutation(db.character.archiveCharacter);
  const deleteCharacter = useMutation(db.character.deleteCharacter);
  const assignOfficerRole = useMutation(db.militia.assignOfficerRole);

  if (!selectedCampaignId) {
    return (
      <p className="text-muted-foreground font-mono text-sm">
        Select a campaign to manage characters.
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

  function startCreate() {
    setEditingId(undefined);
    setFormError(undefined);
    form.reset(defaultCharacterFormValues);
    setIsFormOpen(true);
  }

  function startEdit(character: CharacterRecord) {
    setEditingId(character._id);
    setFormError(undefined);
    form.reset({
      name: character.name,
      description: character.description,
      kind: character.kind ?? 'pc',
      level: String(character.level),
      strength: String(character.strength),
      dexterity: String(character.dexterity),
      constitution: String(character.constitution),
      wisdom: String(character.wisdom),
      charisma: String(character.charisma),
      intelligence: String(character.intelligence),
    });
    setIsFormOpen(true);
  }

  async function submitForm(values: CharacterFormValues) {
    if (!selectedCampaignId) return;
    setFormError(undefined);

    const payload = {
      ...values,
      name: values.name.trim(),
      description: values.description.trim(),
      level: Number(values.level),
      strength: Number(values.strength),
      dexterity: Number(values.dexterity),
      constitution: Number(values.constitution),
      wisdom: Number(values.wisdom),
      charisma: Number(values.charisma),
      intelligence: Number(values.intelligence),
    };

    try {
      if (editingId) {
        await updateCharacter({
          organizationId,
          characterId: editingId,
          patch: {
            ...payload,
            isActive: true,
          },
        });
      } else {
        await createCharacter({
          organizationId,
          character: {
            campaignId: selectedCampaignId,
            ...payload,
          },
        });
      }

      setIsFormOpen(false);
      setEditingId(undefined);
      form.reset(defaultCharacterFormValues);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save character.'));
    }
  }

  async function setOfficer(role: OfficerRole, characterId?: CharacterId) {
    if (!militia) return;
    setAssignmentError(undefined);
    setPendingOfficerRole(role);
    try {
      const result = await assignOfficerRole({
        organizationId,
        militiaId: militia._id,
        role,
        characterId,
        source: 'direct',
      });

      setAssignmentWarnings(result.warnings.map((warning) => warning.message));
    } catch (error) {
      setAssignmentError(
        getErrorMessage(error, 'Failed to update officer assignment.'),
      );
    } finally {
      setPendingOfficerRole(undefined);
    }
  }

  const activeCharacters = characters.filter(
    (character) => character.isActive !== false,
  );
  const archivedCharacters = characters.filter(
    (character) => character.isActive === false,
  );
  const assignableCharacters = activeCharacters.filter(
    (character) =>
      (character.kind ?? 'pc') === 'pc' ||
      (character.kind ?? 'pc') === 'officer_npc',
  );

  async function archive(characterId: CharacterId, isActive: boolean) {
    setArchiveError(undefined);
    setPendingArchiveId(characterId);
    try {
      await archiveCharacter({
        organizationId,
        characterId,
        isActive,
      });
    } catch (error) {
      setArchiveError(getErrorMessage(error, 'Failed to update character status.'));
    } finally {
      setPendingArchiveId(undefined);
    }
  }

  async function deleteArchived(characterId: CharacterId) {
    setArchiveError(undefined);
    setPendingDeleteId(characterId);
    try {
      await deleteCharacter({
        organizationId,
        characterId,
      });
      setDeleteCandidate(undefined);
    } catch (error) {
      setArchiveError(
        getErrorMessage(error, 'Failed to delete archived character.'),
      );
    } finally {
      setPendingDeleteId(undefined);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card flex items-center justify-between border-2 border-b-0 p-4">
        <div>
          <h2 className="text-primary font-sans text-2xl font-bold">
            Character Ledger
          </h2>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            {isLoading
              ? 'Loading...'
              : `Tracking ${activeCharacters.length} active characters`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </Button>
          <Button
            onClick={startCreate}
            className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
          >
            Add Character
          </Button>
        </div>
      </div>

      {isFormOpen ? (
        <CharacterFormCard
          form={form}
          isEditing={Boolean(editingId)}
          onSubmit={submitForm}
          submitError={formError}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingId(undefined);
            setFormError(undefined);
          }}
        />
      ) : null}

      {archiveError ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
          {archiveError}
        </div>
      ) : null}

      <div
        className={
          showArchived ? 'grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start' : ''
        }
      >
        <div className={showArchived ? 'lg:min-w-0' : ''}>
          <CharacterListCard
            activeCharacters={activeCharacters}
            militia={militia}
            archivingCharacterId={pendingArchiveId}
            onEdit={startEdit}
            onArchive={(characterId) => {
              void archive(characterId, false);
            }}
          />
        </div>

        {showArchived ? (
          <div className="lg:min-w-0">
            <ArchivedCharactersCard
              archivedCharacters={archivedCharacters}
              archivingCharacterId={pendingArchiveId}
              deletingCharacterId={pendingDeleteId}
              onUnarchive={(characterId) => {
                void archive(characterId, true);
              }}
              onRequestDelete={(character) => {
                setDeleteCandidate(character);
              }}
            />
          </div>
        ) : null}
      </div>

      <OfficerAssignmentsCard
        militia={militia}
        activeCharacters={activeCharacters}
        assignableCharacters={assignableCharacters}
        assignmentWarnings={assignmentWarnings}
        assignmentError={assignmentError}
        pendingRole={pendingOfficerRole}
        onDismissWarnings={() => setAssignmentWarnings([])}
        onSetOfficer={(role, characterId) => {
          void setOfficer(role, characterId);
        }}
      />

      <Dialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open && !pendingDeleteId) {
            setDeleteCandidate(undefined);
          }
        }}
      >
        <DialogContent className="border-primary bg-card border-2 font-mono">
          <DialogHeader>
            <DialogTitle className="font-sans text-xl">Delete Character</DialogTitle>
            <DialogDescription className="font-mono text-sm">
              {deleteCandidate
                ? `Delete archived character "${deleteCandidate.name}" permanently? This cannot be undone.`
                : 'Delete this archived character permanently?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteCandidate(undefined)}
              disabled={Boolean(pendingDeleteId)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!deleteCandidate) return;
                void deleteArchived(deleteCandidate._id);
              }}
              disabled={Boolean(pendingDeleteId)}
            >
              {pendingDeleteId ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}
