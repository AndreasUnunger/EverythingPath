'use client';

import { api } from '@convex/_generated/api';
import { useMutation } from 'convex/react';
import { useState } from 'react';
import { defaultAttackRoutineConfiguration } from '~/lib/character-sheet-attacks';
import { createCharacterSheetOperationId } from '~/lib/character-sheet-operations';
import type { CharacterScope } from './character-scope';
import type { AttackRoutineValues } from './use-attack-routine-form';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { useEntryWriteStatus } from './use-character-sheet-entries';
import {
  listAttackRoutineRows,
  listAttackRoutineWeapons,
  listAttackWeaponCatalog,
} from './attack-routine-view-model';

/** Uses the living sheet's one subscription and preserves routine identity through Undo. */
export function useCharacterSheetAttacks(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const createRoutine = useMutation(api.characterSheet.createAttackRoutine);
  const editRoutine = useMutation(api.characterSheet.editAttackRoutine);
  const deleteRoutine = useMutation(api.characterSheet.deleteAttackRoutine);
  const restoreRoutine = useMutation(api.characterSheet.restoreAttackRoutine);
  const selectEntry = useMutation(api.characterSheet.selectEntry);
  const scopeKey = JSON.stringify(scope);
  const recorded =
    snapshot?.entries.filter((entry) => entry.kind === 'attackRoutine') ?? [];
  const rows = listAttackRoutineRows(snapshot);
  const weapons = listAttackRoutineWeapons(snapshot);
  const weaponCatalog = listAttackWeaponCatalog(snapshot);
  const state = useEntryWriteStatus({
    signature: snapshot ? JSON.stringify(rows) : null,
    operationId: snapshot?.lastOperationId,
    subject: 'Attack routine',
    scopeKey,
  });
  const [removed, setRemoved] = useState<{
    scopeKey: string;
    entryId: string;
    name: string;
    revision: number;
  } | null>(null);

  function getOperation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  function getRoutine(entryId: string) {
    const entry = recorded.find((candidate) => candidate._id === entryId);
    if (!entry) throw new Error('This attack routine is no longer available.');
    return entry;
  }
  function getWeapon(entryId: string) {
    const entry = weapons.find((candidate) => candidate.entryId === entryId);
    if (!entry)
      throw new Error(
        'This weapon is no longer available. Choose another weapon.',
      );
    return entry;
  }
  async function edit(entryId: string, patch: Partial<AttackRoutineValues>) {
    const entry = getRoutine(entryId);
    const { weaponEntryId, ...fields } = patch;
    const choice =
      weaponEntryId === undefined ? null : getWeapon(weaponEntryId);
    const defaults = choice
      ? defaultAttackRoutineConfiguration(choice.weapon)
      : null;
    await editRoutine({
      ...getOperation(),
      entryId: entry._id,
      ...(defaults ? { hands: defaults.hands, mode: defaults.mode } : {}),
      ...fields,
      ...(weaponEntryId === undefined
        ? {}
        : { weaponEntryId: choice?.entryId }),
    });
  }
  return {
    rows,
    weapons,
    weaponCatalog,
    canCreate: weapons.length > 0,
    statusFor: state.statusFor,
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
    operationId: snapshot?.lastOperationId,
    addWeapon: (catalogEntryId: string) =>
      state.write(
        () => {
          const choice = weaponCatalog.find(
            (entry) => entry.catalogEntryId === catalogEntryId,
          );
          if (!choice)
            throw new Error(
              'This weapon is no longer available. Choose another weapon.',
            );
          return selectEntry({
            ...getOperation(),
            catalogEntryId: choice.catalogEntryId,
          });
        },
        { key: `weapon:${catalogEntryId}`, subject: 'Weapon' },
      ),
    edit,
    create: async (weaponEntryId: string) => {
      const created: {
        entryId: Awaited<ReturnType<typeof createRoutine>> | null;
      } = { entryId: null };
      await state.write(
        async () => {
          created.entryId = await createRoutine({
            ...getOperation(),
            weaponEntryId: getWeapon(weaponEntryId).entryId,
          });
        },
        { key: 'create' },
      );
      return created.entryId;
    },
    remove: (entryId: string) =>
      state.write(
        async () => {
          const entry = getRoutine(entryId);
          const revision = await deleteRoutine({
            ...getOperation(),
            entryId: entry._id,
          });
          if (state.isCurrent())
            setRemoved({ scopeKey, entryId, name: entry.state.name, revision });
        },
        {
          key: entryId,
          subject:
            rows.find((row) => row.entryId === entryId)?.name ??
            'Attack routine',
        },
      ),
    removed: removed?.scopeKey === scopeKey ? removed : null,
    dismissUndo: () => setRemoved(null),
    undo: () =>
      state.write(
        async () => {
          if (removed?.scopeKey !== scopeKey)
            throw new Error('There is no attack routine to restore.');
          const entry = getRoutine(removed.entryId);
          await restoreRoutine({
            ...getOperation(),
            entryId: entry._id,
          });
          if (state.isCurrent()) setRemoved(null);
        },
        { key: 'undo', subject: 'Attack routine' },
      ),
  };
}
