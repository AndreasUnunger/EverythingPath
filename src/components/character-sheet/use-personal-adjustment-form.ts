'use client';

import type { Id } from '@convex/_generated/dataModel';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import {
  personalBonusTypes,
  modifierTargets,
  modifierConditionSchema,
} from '~/lib/character-sheet';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';
import type { PersonalAdjustmentInput } from './use-character-sheet';

const numberPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
const catalogEntryId = z.custom<Id<'catalogEntry'>>(
  (value) => typeof value === 'string' && value.length > 0,
);
const situationOptions =
  modifierConditionSchema.shape.situation.unwrap().options;
const conditionSchema = modifierConditionSchema.strict().extend({
  situation: z
    .union([
      situationOptions[0],
      situationOptions[1],
      situationOptions[2].extend({ option: catalogEntryId }),
    ])
    .optional(),
  whileActive: catalogEntryId.optional(),
});
const schema = z.object({
  name: z
    .string()
    .refine((value) => value.trim().length > 0, 'Adjustment name is required'),
  modifiers: z.array(
    z.object({
      target: z.enum(modifierTargets),
      bonusType: z.enum(personalBonusTypes),
      value: z.string().superRefine((raw, context) => {
        const value = raw.trim();
        if (!value)
          context.addIssue({
            code: 'custom',
            message: 'Modifier value is required',
          });
        else if (!numberPattern.test(value) || !Number.isFinite(Number(value)))
          context.addIssue({
            code: 'custom',
            message: 'Modifier value must be a number',
          });
      }),
      condition: conditionSchema.optional(),
    }),
  ),
});
type Values = z.infer<typeof schema>;
export type PersonalAdjustmentSaveOutcome =
  | 'saved'
  | 'failed'
  | 'remote-conflict';
const emptyModifier: Values['modifiers'][number] = {
  target: 'ability.str',
  bonusType: 'untyped',
  value: '',
};

function formValues(adjustment?: PersonalAdjustmentInput): Values {
  return adjustment
    ? {
        name: adjustment.name,
        modifiers: adjustment.modifiers.map(
          ({ target, bonusType, value, condition }) => ({
            target,
            bonusType: z.enum(personalBonusTypes).parse(bonusType),
            value: String(value),
            ...(condition
              ? {
                  condition: {
                    situation: condition.situation,
                    whileActive: condition.whileActive,
                  },
                }
              : {}),
          }),
        ),
      }
    : { name: '', modifiers: [{ ...emptyModifier }] };
}
function toInput(values: Values): PersonalAdjustmentInput {
  return {
    name: values.name.trim(),
    modifiers: values.modifiers.map((modifier) => ({
      ...modifier,
      value: Number(modifier.value),
    })),
  };
}

function resetToAcceptedAdjustment(form: UseFormReturn<Values>, next: Values) {
  const current = form.getValues();
  const parsed = schema.safeParse(current);
  const retained =
    parsed.success &&
    JSON.stringify(formValues(toInput(parsed.data))) === JSON.stringify(next)
      ? next
      : current;
  form.reset(next);
  form.reset(retained, { keepDefaultValues: true });
}

export function usePersonalAdjustmentForm({
  adjustment,
  save: write,
}: {
  adjustment?: PersonalAdjustmentInput;
  save: (input: PersonalAdjustmentInput) => Promise<unknown>;
}) {
  const incoming = formValues(adjustment);
  const [source, setSource] = useState(incoming);
  const [baseline, setBaseline] = useState(incoming);
  const [pristineValues, setPristineValues] = useState(incoming);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const expected = useRef<string | null>(null);
  const latest = useRef({ source, baseline });
  latest.current = { source, baseline };
  const form = useForm<Values>({
    values: pristineValues,
    resolver: zodResolver(schema),
  });
  const isDirty = form.formState.isDirty;
  if (JSON.stringify(incoming) !== JSON.stringify(source)) {
    setSource(incoming);
    setBaseline(incoming);
    if (expected.current === JSON.stringify(incoming)) expected.current = null;
    else setHasRemoteChange(true);
    // Treat the modifier list as one draft: merging array indexes could apply
    // another player's value to a different modifier after a row was removed.
    if (!isDirty) setPristineValues(incoming);
  }
  const fields = useFieldArray({ control: form.control, name: 'modifiers' });
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const busy = useRef(false);
  void form.formState.errors;
  async function submit(
    values: Values,
  ): Promise<PersonalAdjustmentSaveOutcome> {
    const submitted = formValues(toInput(values));
    if (adjustment && JSON.stringify(submitted) === JSON.stringify(baseline)) {
      form.reset(baseline);
      setStatus({ kind: 'idle' });
      return 'saved';
    }
    expected.current = JSON.stringify(submitted);
    setStatus({ kind: 'saving' });
    function acceptSavedDraft(): PersonalAdjustmentSaveOutcome {
      const next =
        latest.current.source === source ? submitted : latest.current.baseline;
      resetToAcceptedAdjustment(form, next);
      setBaseline(next);
      setStatus({ kind: 'saved' });
      return JSON.stringify(next) === JSON.stringify(submitted)
        ? 'saved'
        : 'remote-conflict';
    }
    try {
      await write(toInput(values));
      return acceptSavedDraft();
    } catch (error) {
      const failure = classifyWriteFailure(error);
      if (failure.kind === 'unknown' && expected.current === null) {
        return acceptSavedDraft();
      }
      expected.current = null;
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Save to try again.`
            : 'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
      });
      return 'failed';
    }
  }
  async function save(): Promise<PersonalAdjustmentSaveOutcome> {
    if (busy.current) return 'failed';
    busy.current = true;
    try {
      let outcome: PersonalAdjustmentSaveOutcome = 'failed';
      await form.handleSubmit(async (values) => {
        outcome = await submit(values);
      })();
      return outcome;
    } finally {
      busy.current = false;
    }
  }
  return {
    form,
    fields: fields.fields,
    addModifier: () => fields.append({ ...emptyModifier }),
    removeModifier: fields.remove,
    status,
    hasRemoteChange,
    dismissRemoteChange: () => setHasRemoteChange(false),
    save,
  };
}
