'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { isOwnCharacterSheetOperation } from '~/lib/character-sheet-operations';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';
import { useSheetFormState } from './use-sheet-form-state';

export const attackRoutineHandsSchema = z.enum(['one', 'two']);
export const attackRoutineModeSchema = z.enum(['melee', 'ranged', 'thrown']);

const schema = z.object({
  name: z
    .string()
    .refine((value) => value.trim().length > 0, 'Routine name is required'),
  weaponEntryId: z.string().min(1, 'Main weapon is required'),
  hands: attackRoutineHandsSchema,
  mode: attackRoutineModeSchema,
});
export type AttackRoutineValues = z.infer<typeof schema>;
type Field = keyof AttackRoutineValues;

/** Each valid field change is saved in order; refused and newer input stays local. */
export function useAttackRoutineForm({
  value,
  save,
  operationId,
}: {
  value: AttackRoutineValues;
  save: (patch: Partial<AttackRoutineValues>) => Promise<unknown>;
  operationId?: string | null;
}) {
  const state = useSheetFormState({
    incoming: value,
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
    isOwnChange: isOwnCharacterSheetOperation(operationId),
  });
  const { form } = state;
  const latest = useRef({ save, source: state.source });
  useEffect(() => {
    latest.current = { save, source: state.source };
  }, [save, state.source]);
  const queue = useRef(Promise.resolve());
  const generations = useRef<Partial<Record<Field, number>>>({});
  const [statuses, setStatuses] = useState<Partial<Record<Field, SaveStatus>>>(
    {},
  );

  function status(field: Field, next: SaveStatus) {
    setStatuses((previous) => ({ ...previous, [field]: next }));
  }
  function persist(field: Field, submitted: AttackRoutineValues[Field]) {
    const generation = (generations.current[field] ?? 0) + 1;
    generations.current[field] = generation;
    const patch = schema.partial().safeParse({ [field]: submitted });
    const parsed = schema.shape[field].safeParse(submitted);
    if (!parsed.success || !patch.success) {
      status(field, { kind: 'idle' });
      form.setError(field, {
        message: !parsed.success
          ? parsed.error.issues[0]?.message
          : 'Enter a valid value',
      });
      return Promise.resolve(false);
    }
    form.clearErrors(field);
    status(field, { kind: 'saving' });
    const task = queue.current.then(async () => {
      const source = latest.current.source;
      state.expected.current = JSON.stringify({
        ...latest.current.source,
        ...patch.data,
      });
      try {
        await latest.current.save(patch.data);
        const current = form.getValues();
        form.reset(
          latest.current.source === source
            ? {
                ...source,
                ...form.formState.defaultValues,
                ...patch.data,
              }
            : latest.current.source,
          { keepErrors: true },
        );
        form.reset(current, { keepDefaultValues: true, keepErrors: true });
        if (generations.current[field] === generation)
          status(field, { kind: 'saved' });
        return true;
      } catch (error) {
        state.expected.current = null;
        const failure = classifyWriteFailure(error);
        if (generations.current[field] === generation)
          status(field, {
            kind: 'error',
            message:
              failure.kind === 'rejected'
                ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Try again.`
                : 'Changes may not have been saved. Your edits are kept. Check them, then try again.',
          });
        return false;
      }
    });
    queue.current = task.then(() => undefined);
    return task;
  }
  return {
    form,
    change: (field: Field, next: AttackRoutineValues[Field]) => {
      form.setValue(field, next, { shouldDirty: true });
      return persist(field, next);
    },
    retry: (field: Field) => persist(field, form.getValues(field)),
    statusFor: (field: Field): SaveStatus =>
      statuses[field] ?? { kind: 'idle' },
    hasRemoteChange: state.hasRemoteChange,
    dismissRemoteChange: state.dismissRemoteChange,
  };
}
