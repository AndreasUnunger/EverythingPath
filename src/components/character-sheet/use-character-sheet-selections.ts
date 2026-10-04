'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';

type ScopeArgs =
  | 'characterId'
  | 'organizationId'
  | 'campaignId'
  | 'operationId';
export type FillSelectionSlotInput = Omit<
  FunctionArgs<typeof api.characterSheet.fillSelectionSlot>,
  ScopeArgs
>;
export type SelectionEditInput = Omit<
  FunctionArgs<typeof api.characterSheet.editSelection>,
  ScopeArgs | 'entryId'
>;
export type PrerequisiteFactsInput = Pick<
  FunctionArgs<typeof api.characterSheet.editCreationSettings>,
  'alignment' | 'deity'
>;

export function useCharacterSheetSelections(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const fillSelectionSlot = useMutation(api.characterSheet.fillSelectionSlot);
  const clearSelectionSlot = useMutation(api.characterSheet.clearSelectionSlot);
  const editSelection = useMutation(api.characterSheet.editSelection);
  const editCreationSettings = useMutation(
    api.characterSheet.editCreationSettings,
  );
  const state = useEntryWriteStatus({
    scopeKey: JSON.stringify(scope),
    signature: snapshot
      ? JSON.stringify({
          entries: snapshot.entries.filter(
            (entry) => entry.kind === 'feat' || entry.kind === 'trait',
          ),
          catalog: snapshot.catalogEntries.filter(
            (entry) =>
              entry.detail.kind === 'feat' || entry.detail.kind === 'trait',
          ),
          facts: snapshot.entries.find((entry) => entry.kind === 'base')?.state,
        })
      : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Selection',
  });
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  const slotKey = (id: string, position: number) =>
    JSON.stringify([id, position]);
  return {
    statusForSlot: (id: string, position: number) =>
      state.statusFor(slotKey(id, position)),
    statusForEntry: state.statusFor,
    factsStatus: state.statusFor('facts'),
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    saveFacts: (input: PrerequisiteFactsInput) =>
      state.write(
        () => editCreationSettings({ ...operation(), settings: {}, ...input }),
        { key: 'facts', subject: 'Alignment and deity' },
      ),
    fill: (input: FillSelectionSlotInput) =>
      state.write(() => fillSelectionSlot({ ...operation(), ...input }), {
        key: slotKey(input.slotId, input.position),
        subject: 'Selection',
      }),
    remove: (entryId: Id<'characterSheetEntry'>) =>
      state.write(() => clearSelectionSlot({ ...operation(), entryId }), {
        key: entryId,
        subject: 'Selection',
      }),
    edit: (entryId: Id<'characterSheetEntry'>, input: SelectionEditInput) =>
      state.write(() => editSelection({ ...operation(), entryId, ...input }), {
        key: entryId,
        subject: 'Selection',
      }),
  };
}
