'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import type { FunctionArgs } from 'convex/server';
import { useRef, useState } from 'react';
import {
  createCharacterSheetOperationId,
  isOwnCharacterSheetOperation,
} from '~/lib/character-sheet-operations';
import { isCatalogSheetEntry } from '~/lib/character-sheet-entries';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import type { SaveStatus } from './save-status';

export type AbilityChangeInput = Pick<
  FunctionArgs<typeof api.characterSheet.createAbilityChange>,
  'kind' | 'ability' | 'points'
>;
export type SheetEntryInput = Pick<
  FunctionArgs<typeof api.characterSheet.createSheetEntry>,
  'name' | 'modifiers' | 'detail' | 'casterLevel'
>;
export type SheetEntryEditInput = Pick<
  FunctionArgs<typeof api.characterSheet.editSheetEntry>,
  'name' | 'modifiers' | 'detail' | 'casterLevel' | 'active'
>;

function useEntryWriteStatus({
  signature,
  operationId,
  subject,
}: {
  signature: string | null;
  operationId: string | null | undefined;
  subject: string;
}) {
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [previous, setPrevious] = useState(signature);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const busy = useRef(false);
  if (previous !== signature) {
    setPrevious(signature);
    if (previous !== null && !isOwnCharacterSheetOperation(operationId))
      setHasRemoteChange(true);
  }
  async function write(action: () => Promise<unknown>) {
    if (busy.current) return;
    busy.current = true;
    setStatus({ kind: 'saving' });
    try {
      await action();
      setStatus({ kind: 'saved' });
    } catch (error) {
      const failure = classifyWriteFailure(error);
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `${subject} wasn't saved${refusalReason(failure.message)} Try again.`
            : `${subject} may not have been saved. Check it before trying again.`,
      });
    } finally {
      busy.current = false;
    }
  }
  return {
    status,
    hasRemoteChange,
    dismissRemoteChange: () => setHasRemoteChange(false),
    write,
  };
}

export function useCharacterSheetEntries(
  scope: CharacterScope,
  snapshot: CharacterSheetSnapshot | null | undefined,
) {
  const createAbilityChange = useMutation(
    api.characterSheet.createAbilityChange,
  );
  const editAbilityChange = useMutation(api.characterSheet.editAbilityChange);
  const removeAbilityChange = useMutation(
    api.characterSheet.removeAbilityChange,
  );
  const createSheetEntry = useMutation(api.characterSheet.createSheetEntry);
  const editSheetEntry = useMutation(api.characterSheet.editSheetEntry);
  const removeSheetEntry = useMutation(api.characterSheet.removeSheetEntry);
  const abilitySignature = snapshot
    ? JSON.stringify(
        snapshot.entries.filter(
          (row) => row.kind === 'abilityDamage' || row.kind === 'abilityDrain',
        ),
      )
    : null;
  const entrySignature = snapshot
    ? JSON.stringify({
        entries: snapshot.entries.filter(isCatalogSheetEntry),
        catalog: snapshot.catalogEntries.filter((row) =>
          isCatalogSheetEntry(row.detail),
        ),
      })
    : null;
  const abilityState = useEntryWriteStatus({
    signature: abilitySignature,
    operationId: snapshot?.lastOperationId,
    subject: 'Ability change',
  });
  const entryState = useEntryWriteStatus({
    signature: entrySignature,
    operationId: snapshot?.lastOperationId,
    subject: 'Character Sheet Entry',
  });
  function operation() {
    if (!snapshot) throw new Error('Character sheet is not available.');
    return {
      ...scope,
      characterId: snapshot.character._id,
      operationId: createCharacterSheetOperationId(),
    };
  }
  return {
    abilityChanges: {
      status: abilityState.status,
      hasRemoteChange: abilityState.hasRemoteChange,
      dismissRemoteChange: abilityState.dismissRemoteChange,
      create: (input: AbilityChangeInput) =>
        createAbilityChange({ ...operation(), ...input }),
      edit: (
        entryId: Id<'characterSheetEntry'>,
        input: Partial<Omit<AbilityChangeInput, 'kind'>>,
      ) => editAbilityChange({ ...operation(), entryId, ...input }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        abilityState.write(() =>
          editAbilityChange({ ...operation(), entryId, active }),
        ),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        abilityState.write(() =>
          removeAbilityChange({ ...operation(), entryId }),
        ),
    },
    sheetEntries: {
      status: entryState.status,
      hasRemoteChange: entryState.hasRemoteChange,
      dismissRemoteChange: entryState.dismissRemoteChange,
      create: (input: SheetEntryInput) =>
        createSheetEntry({ ...operation(), ...input }),
      edit: (entryId: Id<'characterSheetEntry'>, input: SheetEntryEditInput) =>
        editSheetEntry({ ...operation(), entryId, ...input }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        entryState.write(() =>
          editSheetEntry({ ...operation(), entryId, active }),
        ),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        entryState.write(() => removeSheetEntry({ ...operation(), entryId })),
    },
  };
}
