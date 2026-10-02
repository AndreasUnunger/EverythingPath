'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { useRef, useState } from 'react';
import type { AbilityScores } from '~/lib/character-sheet';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';

export type CharacterSheetSnapshot = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;
type Scope = { organizationId: string; characterId: string };

export function useCharacterSheet(scope: Scope) {
  const snapshot = useQuery(api.characterSheet.read, scope);
  const editBaseScores = useMutation(api.characterSheet.editBaseScores);
  const editClassLevel = useMutation(api.characterSheet.editClassLevel);
  const addClassLevel = useMutation(api.characterSheet.addClassLevel);
  const moveClassLevel = useMutation(api.characterSheet.moveClassLevel);
  const deleteClassLevel = useMutation(api.characterSheet.deleteClassLevel);
  const operations = useRef(new Set<string>());
  const isBusy = useRef(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [appendedEntryId, setAppendedEntryId] =
    useState<Id<'characterSheetEntry'> | null>(null);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const sheet = snapshot ? buildSheetView(snapshot) : snapshot;
  const ordered = sheet?.levels;
  const signature = ordered?.map((entry) => entry._id).join(',') ?? null;
  const [previous, setPrevious] = useState(signature);
  if (signature !== previous) {
    setPrevious(signature);
    if (
      previous !== null &&
      snapshot &&
      !operations.current.has(snapshot.lastOperationId ?? '')
    )
      setHasRemoteChange(true);
  }

  function createOperation() {
    const operationId = crypto.randomUUID();
    operations.current.add(operationId);
    if (!snapshot) throw new Error('Character sheet is not available.');
    return { ...scope, characterId: snapshot.character._id, operationId };
  }

  async function saveBaseScores(scores: Partial<AbilityScores>) {
    await editBaseScores({ ...createOperation(), scores });
  }

  async function saveHitPoints(
    entryId: Id<'characterSheetEntry'>,
    hpGained: number | null,
  ) {
    await editClassLevel({ ...createOperation(), entryId, hpGained });
  }

  async function changeLevels(write: () => Promise<unknown>) {
    if (isBusy.current) return;
    isBusy.current = true;
    setStatus({ kind: 'saving' });
    try {
      await write();
      setStatus({ kind: 'saved' });
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Class Levels weren't saved${refusalReason(failure.message)} Try again.`
            : 'Class Levels may not have been saved. Check the levels before trying again.',
      });
    } finally {
      isBusy.current = false;
    }
  }

  return {
    sheet,
    saveBaseScores,
    saveHitPoints,
    levels: {
      status,
      hasRemoteChange,
      appendedEntryId,
      dismissRemoteChange: () => setHasRemoteChange(false),
      acknowledgeAppend: () => setAppendedEntryId(null),
      add: () =>
        changeLevels(async () => {
          setAppendedEntryId(await addClassLevel(createOperation()));
        }),
      move: (entryId: Id<'characterSheetEntry'>, position: number) =>
        changeLevels(() =>
          moveClassLevel({ ...createOperation(), entryId, position }),
        ),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        changeLevels(() => deleteClassLevel({ ...createOperation(), entryId })),
    },
  };
}

function buildSheetView(snapshot: CharacterSheetSnapshot) {
  const calculated = snapshot.calculated;
  return {
    character: snapshot.character,
    calculated,
    baseScores: {
      strength: calculated.abilities.strength.score,
      dexterity: calculated.abilities.dexterity.score,
      constitution: calculated.abilities.constitution.score,
      intelligence: calculated.abilities.intelligence.score,
      wisdom: calculated.abilities.wisdom.score,
      charisma: calculated.abilities.charisma.score,
    },
    levels: snapshot.entries.filter((entry) => entry.kind === 'classLevel'),
    warning:
      snapshot.character.kind === 'pc' && calculated.level === 0
        ? 'This PC has no Class Levels.'
        : null,
  };
}
