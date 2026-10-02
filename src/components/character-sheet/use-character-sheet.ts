'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { useRef, useState } from 'react';
import type {
  AbilityScores,
  CreationSettings,
  SheetWarning,
} from '~/lib/character-sheet';
import {
  createCharacterSheetOperationId,
  isOwnCharacterSheetOperation,
} from '~/lib/character-sheet-operations';
import { detectRemoteWarningChange } from '~/lib/character-sheet-changes';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { SaveStatus } from './save-status';

export type CharacterSheetSnapshot = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;
export type SheetWarningView = SheetWarning & {
  accepted: boolean;
};

function warningKey(warning: SheetWarning) {
  return JSON.stringify([warning.check, warning.subject, warning.fingerprint]);
}

export function useCharacterSheet(scope: CharacterScope) {
  const snapshot = useQuery(api.characterSheet.read, scope);
  const editBaseScores = useMutation(api.characterSheet.editBaseScores);
  const editClassLevel = useMutation(api.characterSheet.editClassLevel);
  const addClassLevel = useMutation(api.characterSheet.addClassLevel);
  const moveClassLevel = useMutation(api.characterSheet.moveClassLevel);
  const deleteClassLevel = useMutation(api.characterSheet.deleteClassLevel);
  const editCreationSettings = useMutation(
    api.characterSheet.editCreationSettings,
  );
  const acceptWarning = useMutation(api.characterSheet.acceptWarning);
  const reopenWarning = useMutation(api.characterSheet.reopenWarning);
  const pendingWarnings = useRef(new Set<string>());
  const expectedWarnings = useRef(
    new Map<string, { accepted: boolean; revision: number }>(),
  );
  const [warningStatuses, setWarningStatuses] = useState<
    Record<string, SaveStatus>
  >({});
  const [hasRemoteWarnings, setHasRemoteWarnings] = useState(false);
  const isBusy = useRef(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [appendedEntryId, setAppendedEntryId] =
    useState<Id<'characterSheetEntry'> | null>(null);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const sheet = snapshot ? buildSheetView(snapshot) : snapshot;
  const warningStates = sheet
    ? Object.fromEntries(
        sheet.warnings.map((warning) => [
          warningKey(warning),
          warning.accepted,
        ]),
      )
    : null;
  const [previousWarnings, setPreviousWarnings] = useState(warningStates);
  const warningChange = detectRemoteWarningChange({
    previous: previousWarnings,
    next: warningStates,
    expectedOperations: expectedWarnings.current,
    isOwnOperation: isOwnCharacterSheetOperation(snapshot?.lastOperationId),
  });
  if (warningChange.changed) {
    setPreviousWarnings(warningStates);
    for (const key of warningChange.acknowledged)
      expectedWarnings.current.delete(key);
    if (warningChange.hasRemoteChange) setHasRemoteWarnings(true);
  }
  // A successful Convex mutation has reached its query transition. Retire
  // overwritten intentions too, even when coalescing left the warning unchanged.
  for (const [key, expected] of expectedWarnings.current) {
    if (
      snapshot &&
      snapshot.revision > expected.revision &&
      !pendingWarnings.current.has(key)
    )
      expectedWarnings.current.delete(key);
  }
  const ordered = sheet?.levels;
  const signature = ordered?.map((entry) => entry._id).join(',') ?? null;
  const [previous, setPrevious] = useState(signature);
  if (signature !== previous) {
    setPrevious(signature);
    if (
      previous !== null &&
      snapshot &&
      !isOwnCharacterSheetOperation(snapshot.lastOperationId)
    )
      setHasRemoteChange(true);
  }

  function createOperation() {
    const operationId = createCharacterSheetOperationId();
    if (!snapshot) throw new Error('Character sheet is not available.');
    return { ...scope, characterId: snapshot.character._id, operationId };
  }

  async function saveBaseScores(scores: Partial<AbilityScores>) {
    await editBaseScores({ ...createOperation(), scores });
  }

  async function saveCreationSettings(settings: Partial<CreationSettings>) {
    await editCreationSettings({ ...createOperation(), settings });
  }

  async function changeWarning(warning: SheetWarningView, accept: boolean) {
    if (warning.kind !== 'rules') return;
    const key = warningKey(warning);
    if (pendingWarnings.current.has(key)) return;
    pendingWarnings.current.add(key);
    expectedWarnings.current.set(key, {
      accepted: accept,
      revision: snapshot?.revision ?? 0,
    });
    const updateStatus = (status: SaveStatus) =>
      setWarningStatuses((previous) => ({ ...previous, [key]: status }));
    updateStatus({ kind: 'saving' });
    try {
      const args = {
        ...createOperation(),
        check: warning.check,
        subject: warning.subject,
      };
      if (accept)
        await acceptWarning({ ...args, fingerprint: warning.fingerprint });
      else await reopenWarning(args);
      updateStatus({ kind: 'saved' });
    } catch (error) {
      expectedWarnings.current.delete(key);
      const failure = classifyWriteFailure(error);
      updateStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Warning wasn't saved${refusalReason(failure.message)} Try again.`
            : 'Warning may not have been saved. Check it before trying again.',
      });
    } finally {
      pendingWarnings.current.delete(key);
    }
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
    saveCreationSettings,
    warnings: {
      accept: (warning: SheetWarningView) => changeWarning(warning, true),
      reopen: (warning: SheetWarningView) => changeWarning(warning, false),
      statusFor: (warning: SheetWarning): SaveStatus =>
        warningStatuses[warningKey(warning)] ?? { kind: 'idle' },
      hasRemoteChange: hasRemoteWarnings,
      dismissRemoteChange: () => setHasRemoteWarnings(false),
    },
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
    warnings: calculated.warnings.map(
      (warning): SheetWarningView => ({
        ...warning,
        accepted:
          warning.kind === 'rules' &&
          snapshot.acceptedWarnings.some(
            (accepted) =>
              accepted.check === warning.check &&
              accepted.subject === warning.subject &&
              accepted.fingerprint === warning.fingerprint,
          ),
      }),
    ),
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
