'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Id } from '@convex/_generated/dataModel';
import { api as db } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { useRef } from 'react';
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
import { LedgerShell } from '~/components/ledger-shell';
import { useActivityCardDrag } from '~/hooks/use-activity-card-drag';
import type { PointerCardDragState } from '~/lib/pointer-card-drag';
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
  officerRoleLabels,
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
  const [isOpen, setIsOpen] = useState(false);
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
  const [dragState, setDragState] =
    useState<PointerCardDragState<CharacterId> | null>(null);
  const [activeDropRoleId, setActiveDropRoleId] = useState<string | null>(null);
  const [pendingArchiveId, setPendingArchiveId] = useState<
    Id<'character'> | undefined
  >();
  const [pendingDeleteId, setPendingDeleteId] = useState<
    Id<'character'> | undefined
  >();
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
  const roleRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        Checking organization access...
      </p>
    );
  }

  function startCreate() {
    setEditingId(undefined);
    setFormError(undefined);
    form.reset(defaultCharacterFormValues);
    setIsFormOpen(true);
  }

  function closeCharacterForm() {
    setIsFormOpen(false);
    setEditingId(undefined);
    setFormError(undefined);
  }

  function closeCharacterLedger() {
    closeCharacterForm();
    setShowArchived(false);
    setDeleteCandidate(undefined);
    setDragState(null);
    setActiveDropRoleId(null);
  }

  function startEdit(character: CharacterRecord) {
    setEditingId(character._id);
    setFormError(undefined);
    form.reset({
      name: character.name,
      description: character.description,
      kind: character.kind ?? 'pc',
      officerRole:
        officerRoleLabels.find(
          (officerRole) => militia?.[officerRole.role] === character._id,
        )?.role ?? 'none',
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
      name: values.name.trim(),
      description: values.description.trim(),
      kind: values.kind,
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
        await setCharacterOfficerRole(
          editingId,
          values.officerRole === 'none' ? undefined : values.officerRole,
        );
      } else {
        const characterId = await createCharacter({
          organizationId,
          character: {
            campaignId: selectedCampaignId,
            ...payload,
          },
        });
        if (values.officerRole !== 'none') {
          await setCharacterOfficerRole(characterId, values.officerRole);
        }
      }

      setIsFormOpen(false);
      setEditingId(undefined);
      form.reset(defaultCharacterFormValues);
    } catch (error) {
      setFormError(getErrorMessage(error, 'Failed to save character.'));
    }
  }

  async function setCharacterOfficerRole(
    characterId: CharacterId,
    nextRole?: OfficerRole,
  ) {
    if (!militia) return;
    setAssignmentError(undefined);
    try {
      const currentRole = officerRoleLabels.find(
        (officerRole) => militia[officerRole.role] === characterId,
      )?.role;

      if (currentRole && currentRole !== nextRole) {
        await assignOfficerRole({
          organizationId,
          militiaId: militia._id,
          role: currentRole,
          characterId: undefined,
          source: 'direct',
        });
      }

      if (!nextRole) {
        setAssignmentWarnings([]);
        return;
      }

      const result = await assignOfficerRole({
        organizationId,
        militiaId: militia._id,
        role: nextRole,
        characterId,
        source: 'direct',
      });

      setAssignmentWarnings(result.warnings.map((warning) => warning.message));
    } catch (error) {
      setAssignmentError(
        getErrorMessage(error, 'Failed to update officer assignment.'),
      );
    } finally {
      setDragState(null);
      setActiveDropRoleId(null);
    }
  }

  async function clearOfficerRole(role: OfficerRole) {
    if (!militia) return;
    setAssignmentError(undefined);
    setPendingOfficerRole(role);
    try {
      await assignOfficerRole({
        organizationId,
        militiaId: militia._id,
        role,
        characterId: undefined,
        source: 'direct',
      });
      setAssignmentWarnings([]);
    } catch (error) {
      setAssignmentError(
        getErrorMessage(error, 'Failed to update officer assignment.'),
      );
    } finally {
      setPendingOfficerRole(undefined);
    }
  }

  const activeCharacters = characters
    .filter((character) => character.isActive !== false)
    .sort((left, right) => left.name.localeCompare(right.name));
  const archivedCharacters = characters.filter(
    (character) => character.isActive === false,
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
      setArchiveError(
        getErrorMessage(error, 'Failed to update character status.'),
      );
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

  function toggleLedger() {
    if (isOpen) {
      closeCharacterLedger();
    }
    setIsOpen((prev) => !prev);
  }

  useActivityCardDrag<CharacterId>({
    dragState,
    setDragState,
    slotRows: officerRoleLabels.map(({ role }, index) => ({
      slotId: role,
      slotNumber: index + 1,
    })),
    slotRefs: roleRefs,
    setActiveDropSlotId: setActiveDropRoleId,
    onDrop: ({ dropSlotIndex, actionId }) => {
      if (dropSlotIndex === null) {
        return;
      }
      const dropRole = officerRoleLabels[dropSlotIndex]?.role;
      if (!dropRole) {
        return;
      }
      void setCharacterOfficerRole(actionId, dropRole);
    },
  });

  return (
    <LedgerShell
      title="Character Ledger"
      meta={
        isLoading
          ? 'Loading...'
          : `Tracking ${activeCharacters.length} active characters`
      }
      isOpen={isOpen}
      onToggle={toggleLedger}
      actions={
        isOpen ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowArchived((prev) => !prev)}
            >
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </Button>
            <Button
              type="button"
              onClick={startCreate}
              className="border-primary text-primary hover:bg-primary/80 hover:text-primary-foreground border-2 bg-transparent font-mono text-base"
            >
              Add Character
            </Button>
          </>
        ) : null
      }
    >
      <>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            if (!open) closeCharacterForm();
          }}
        >
          <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="font-sans text-xl">
                {editingId ? 'Edit Character' : 'New Character'}
              </DialogTitle>
              <DialogDescription className="font-mono text-sm">
                Update the character record and officer role in one place.
              </DialogDescription>
            </DialogHeader>
            <CharacterFormCard
              form={form}
              onSubmit={submitForm}
              submitError={formError}
              onCancel={closeCharacterForm}
            />
          </DialogContent>
        </Dialog>

        {archiveError ? (
          <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
            {archiveError}
          </div>
        ) : null}

        <OfficerAssignmentsCard
          militia={militia}
          activeCharacters={activeCharacters}
          assignmentWarnings={assignmentWarnings}
          assignmentError={assignmentError}
          pendingRole={pendingOfficerRole}
          dragState={dragState}
          activeDropRoleId={activeDropRoleId}
          roleRefs={roleRefs}
          onDismissWarnings={() => setAssignmentWarnings([])}
          onClearRole={(role) => {
            void clearOfficerRole(role);
          }}
        />

        <CharacterListCard
          activeCharacters={activeCharacters}
          militia={militia}
          archivingCharacterId={pendingArchiveId}
          dragState={dragState}
          onEdit={startEdit}
          onArchive={(characterId) => {
            void archive(characterId, false);
          }}
          onStartDrag={setDragState}
        />

        <Dialog
          open={showArchived}
          onOpenChange={(open) => {
            if (!open && !pendingArchiveId && !pendingDeleteId) {
              setShowArchived(false);
              return;
            }
            if (open) {
              setShowArchived(true);
            }
          }}
        >
          <DialogContent className="border-primary bg-card border-2 font-mono sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="font-sans text-xl">
                Archived Characters
              </DialogTitle>
              <DialogDescription className="font-mono text-sm">
                Review archived entries, restore them to the ledger, or delete
                them permanently.
              </DialogDescription>
            </DialogHeader>
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
          </DialogContent>
        </Dialog>

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
              <DialogTitle className="font-sans text-xl">
                Delete Character
              </DialogTitle>
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
      </>
    </LedgerShell>
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
