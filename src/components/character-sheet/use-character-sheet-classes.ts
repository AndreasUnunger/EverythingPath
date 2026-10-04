'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useMemo } from 'react';
import { characterSheetClassFamily } from '~/lib/character-sheet-grants';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import {
  buildCharacterSheetClassesView,
  emptyClassCatalogChoices,
} from './character-sheet-classes-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

/** Prestige entry and version controls share the sheet's live read. */
export function useCharacterSheetClasses(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
  catalogChoices: readonly CharacterSheetSnapshot['catalogEntries'][number][] = emptyClassCatalogChoices,
) {
  const switchVersion = useMutation(api.characterSheet.switchClassVersion);
  const view = useMemo(
    () =>
      snapshot
        ? buildCharacterSheetClassesView(snapshot, catalogChoices)
        : null,
    [snapshot, catalogChoices],
  );
  const signature = snapshot
    ? JSON.stringify(
        snapshot.entries.flatMap((entry) =>
          entry.kind === 'classLevel'
            ? [[entry._id, entry.active, entry.state.classEntryId]]
            : [],
        ),
      )
    : null;
  const state = useEntryWriteStatus({
    scopeKey: snapshot?.character._id ?? scope.characterId,
    signature,
    operationId: snapshot?.lastOperationId,
    subject: 'Class version',
  });
  function familyKey(entryId: Id<'characterSheetEntry'>) {
    const row = snapshot?.entries.find((entry) => entry._id === entryId);
    if (row?.kind !== 'classLevel') return entryId;
    const definition = snapshot?.catalogEntries.find(
      (entry) => entry._id === row.state.classEntryId,
    );
    return definition && snapshot
      ? characterSheetClassFamily(definition, snapshot.catalogEntries)
      : entryId;
  }
  return {
    lastOperationId: snapshot?.lastOperationId,
    isVersionChange: (previous: string, next: string) =>
      view?.isVersionChange(previous, next) ?? false,
    isLoading: snapshot === undefined,
    isUnavailable: snapshot === null,
    choices: view?.choices ?? [],
    preview: (
      classEntryId: Id<'catalogEntry'>,
      entryId?: Id<'characterSheetEntry'>,
    ) => view?.preview(classEntryId, entryId) ?? null,
    warnings: view?.warnings ?? [],
    versionChoicesFor: (entryId: Id<'characterSheetEntry'>) =>
      view?.versionChoicesFor(entryId) ?? [],
    statusFor: (entryId: Id<'characterSheetEntry'>) =>
      state.statusFor(familyKey(entryId)),
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    switchVersion: (
      entryId: Id<'characterSheetEntry'>,
      classEntryId: Id<'catalogEntry'>,
    ) =>
      state.write(
        async () => {
          if (!snapshot) throw new Error('Character sheet is not available.');
          await switchVersion({
            ...scope,
            characterId: snapshot.character._id,
            operationId: createCharacterSheetOperationId(),
            entryId,
            classEntryId,
          });
        },
        { key: familyKey(entryId) },
      ),
  };
}
