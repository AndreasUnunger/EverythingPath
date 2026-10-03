'use client';

import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import { useMutation, useQuery } from 'convex/react';
import { useRef, useState, type RefObject } from 'react';
import type {
  AbilityScores,
  CreationSettings,
  SheetWarning,
} from '~/lib/character-sheet';
import {
  createCharacterSheetOperationId,
  isOwnCharacterSheetOperation,
} from '~/lib/character-sheet-operations';
import { detectRemoteSheetChange } from '~/lib/character-sheet-changes';
import { parseCharacterSheetBreakdowns } from '~/lib/character-sheet-breakdowns';
import {
  calculateCharacterSheet,
  type ResolveOptions,
  abilityTargets,
  type Ability,
} from '~/lib/character-sheet';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { CharacterScope } from './character-scope';
import type { SaveStatus } from './save-status';

export type CharacterSheetSnapshot = NonNullable<
  FunctionReturnType<typeof api.characterSheet.read>
>;
export type SheetWarningView = SheetWarning & {
  accepted: boolean;
};
export type PersonalAdjustmentInput = Pick<
  FunctionArgs<typeof api.characterSheet.createPersonalAdjustment>,
  'name' | 'modifiers'
>;

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
    new Map<string, { value: boolean; revision: number }>(),
  );
  const [warningStatuses, setWarningStatuses] = useState<
    Record<string, SaveStatus>
  >({});
  const [hasRemoteWarnings, setHasRemoteWarnings] = useState(false);
  const createPersonalAdjustment = useMutation(
    api.characterSheet.createPersonalAdjustment,
  );
  const editPersonalAdjustment = useMutation(
    api.characterSheet.editPersonalAdjustment,
  );
  const removePersonalAdjustment = useMutation(
    api.characterSheet.removePersonalAdjustment,
  );
  const adjustmentBusy = useRef(false);
  const [adjustmentStatus, setAdjustmentStatus] = useState<SaveStatus>({
    kind: 'idle',
  });
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
  const warningChange = detectRemoteSheetChange({
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
  const levelChange = detectRemoteSheetChange({
    previous: previous === null ? null : { levels: previous },
    next: signature === null ? null : { levels: signature },
    expectedOperations: new Map(),
    isOwnOperation: isOwnCharacterSheetOperation(snapshot?.lastOperationId),
  });
  if (levelChange.changed) {
    setPrevious(signature);
    if (levelChange.hasRemoteChange) setHasRemoteChange(true);
  }

  const [hasRemoteAdjustmentChange, setHasRemoteAdjustmentChange] =
    useState(false);
  const adjustmentSignature = sheet ? JSON.stringify(sheet.adjustments) : null;
  const [previousAdjustments, setPreviousAdjustments] =
    useState(adjustmentSignature);
  const adjustmentChange = detectRemoteSheetChange({
    previous:
      previousAdjustments === null
        ? null
        : { adjustments: previousAdjustments },
    next:
      adjustmentSignature === null
        ? null
        : { adjustments: adjustmentSignature },
    expectedOperations: new Map(),
    isOwnOperation: isOwnCharacterSheetOperation(snapshot?.lastOperationId),
  });
  if (adjustmentChange.changed) {
    setPreviousAdjustments(adjustmentSignature);
    if (adjustmentChange.hasRemoteChange) setHasRemoteAdjustmentChange(true);
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
      value: accept,
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

  return {
    sheet,
    previewSituation: (
      situation: NonNullable<ResolveOptions['situations']>[number],
    ) =>
      snapshot
        ? calculateCharacterSheet(
            { ...snapshot, characterKind: snapshot.character.kind },
            { situations: [situation] },
          )
        : null,
    adjustments: {
      status: adjustmentStatus,
      hasRemoteChange: hasRemoteAdjustmentChange,
      dismissRemoteChange: () => setHasRemoteAdjustmentChange(false),
      create: (input: PersonalAdjustmentInput) =>
        createPersonalAdjustment({ ...createOperation(), ...input }),
      edit: (
        entryId: Id<'characterSheetEntry'>,
        input: PersonalAdjustmentInput,
      ) => editPersonalAdjustment({ ...createOperation(), entryId, ...input }),
      setActive: (entryId: Id<'characterSheetEntry'>, active: boolean) =>
        guardedWrite({
          busy: adjustmentBusy,
          setStatus: setAdjustmentStatus,
          subject: 'Personal adjustment',
          inspect: 'it',
          write: () =>
            editPersonalAdjustment({ ...createOperation(), entryId, active }),
        }),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        guardedWrite({
          busy: adjustmentBusy,
          setStatus: setAdjustmentStatus,
          subject: 'Personal adjustment',
          inspect: 'it',
          write: () =>
            removePersonalAdjustment({ ...createOperation(), entryId }),
        }),
    },
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
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: async () => {
            setAppendedEntryId(await addClassLevel(createOperation()));
          },
        }),
      move: (entryId: Id<'characterSheetEntry'>, position: number) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: () =>
            moveClassLevel({ ...createOperation(), entryId, position }),
        }),
      remove: (entryId: Id<'characterSheetEntry'>) =>
        guardedWrite({
          busy: isBusy,
          setStatus,
          subject: 'Class Levels',
          inspect: 'the levels',
          write: () => deleteClassLevel({ ...createOperation(), entryId }),
        }),
    },
  };
}

function buildSheetView(snapshot: CharacterSheetSnapshot) {
  const calculated = {
    ...snapshot.calculated,
    breakdowns: parseCharacterSheetBreakdowns(snapshot.calculated.breakdowns),
  };
  function baseScore(ability: Ability) {
    const modifier = snapshot.baseScoresEntry.modifiers.find(
      (item) =>
        item.target === abilityTargets[ability] && item.bonusType === 'base',
    );
    if (!modifier) throw new Error('Base score is unavailable.');
    return modifier.value;
  }
  return {
    character: snapshot.character,
    owner: snapshot.owner,
    campaign: snapshot.campaign,
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
      strength: baseScore('strength'),
      dexterity: baseScore('dexterity'),
      constitution: baseScore('constitution'),
      intelligence: baseScore('intelligence'),
      wisdom: baseScore('wisdom'),
      charisma: baseScore('charisma'),
    },
    adjustments: snapshot.entries
      .filter((entry) => entry.kind === 'manual')
      .map((entry) => {
        const catalogEntry = snapshot.catalogEntries.find(
          (item) => item._id === entry.catalogEntryId,
        );
        if (!catalogEntry)
          throw new Error('Personal adjustment is unavailable.');
        return {
          entryId: entry._id,
          catalogEntryId: catalogEntry._id,
          active: entry.active,
          name: catalogEntry.name,
          modifiers: catalogEntry.modifiers,
        };
      }),
    levels: snapshot.entries.filter((entry) => entry.kind === 'classLevel'),
    warning:
      snapshot.character.kind === 'pc' && calculated.level === 0
        ? 'This PC has no Class Levels.'
        : null,
  };
}

async function guardedWrite({
  busy,
  setStatus,
  subject,
  inspect,
  write,
}: {
  busy: RefObject<boolean>;
  setStatus: (status: SaveStatus) => void;
  subject: 'Class Levels' | 'Personal adjustment';
  inspect: string;
  write: () => Promise<unknown>;
}) {
  if (busy.current) return;
  busy.current = true;
  setStatus({ kind: 'saving' });
  try {
    await write();
    setStatus({ kind: 'saved' });
  } catch (error) {
    const failure = classifyWriteFailure(error);
    const agreement = subject === 'Class Levels' ? "weren't" : "wasn't";
    setStatus({
      kind: 'error',
      message:
        failure.kind === 'rejected'
          ? `${subject} ${agreement} saved${refusalReason(failure.message)} Try again.`
          : `${subject} may not have been saved. Check ${inspect} before trying again.`,
    });
  } finally {
    busy.current = false;
  }
}
