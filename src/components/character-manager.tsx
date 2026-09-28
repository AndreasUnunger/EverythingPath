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
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { LedgerShell } from '~/components/ledger-shell';
import { normalizeCharacterKind } from '~/lib/character-kind';
import { characterLedgerQuery } from '~/lib/sharedQueries';
import { ArchivedCharactersCard } from './character-manager/archived-characters-card';
import { CharacterDialog } from './character-manager/character-dialog';
import { CharacterListCard } from './character-manager/character-list-card';
import {
  getCharacterErrorMessage,
  characterFormSchema,
  toCharacterPayload,
  defaultCharacterFormValues,
  type CharacterFormValues,
  type CharacterId,
  type CharacterRecord,
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
  const [showArchived, setShowArchived] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [archiveError, setArchiveError] = useState<string>();
  const [pendingArchiveId, setPendingArchiveId] = useState<
    Id<'character'> | undefined
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
  const createCharacter = useMutation(db.character.createCharacter);
  const updateCharacter = useMutation(db.character.updateCharacter);
  const archiveCharacter = useMutation(db.character.archiveCharacter);
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
  }

  function startEdit(character: CharacterRecord) {
    setEditingId(character._id);
    setFormError(undefined);
    form.reset({
      name: character.name,
      description: character.description,
      kind: normalizeCharacterKind(character.kind),
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

    const payload = toCharacterPayload(values);

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
      setFormError(
        getCharacterErrorMessage(error, 'Failed to save character.'),
      );
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
        getCharacterErrorMessage(error, 'Failed to update character status.'),
      );
    } finally {
      setPendingArchiveId(undefined);
    }
  }

  function toggleLedger() {
    if (isOpen) {
      closeCharacterLedger();
    }
    setIsOpen((prev) => !prev);
  }

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
        <CharacterDialog
          open={isFormOpen}
          onOpenChange={(open) => {
            if (!open) closeCharacterForm();
          }}
          title={editingId ? 'Edit Character' : 'New Character'}
          description="Update the character record. Officer assignments are in the militia ledger."
          form={form}
          onSubmit={submitForm}
          submitError={formError}
        />

        {archiveError ? (
          <div className="border-destructive/50 bg-destructive/10 text-destructive p-2 font-mono text-sm">
            {archiveError}
          </div>
        ) : null}

        <CharacterListCard
          activeCharacters={activeCharacters}
          archivingCharacterId={pendingArchiveId}
          onEdit={startEdit}
          onArchive={(characterId) => {
            void archive(characterId, false);
          }}
        />

        <Dialog
          open={showArchived}
          onOpenChange={(open) => {
            if (!open && !pendingArchiveId) {
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
                Review archived entries or restore them to the ledger.
              </DialogDescription>
            </DialogHeader>
            <ArchivedCharactersCard
              archivedCharacters={archivedCharacters}
              archivingCharacterId={pendingArchiveId}
              onUnarchive={(characterId) => {
                void archive(characterId, true);
              }}
            />
          </DialogContent>
        </Dialog>
      </>
    </LedgerShell>
  );
}
