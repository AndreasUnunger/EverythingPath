'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSheetFormState } from './use-sheet-form-state';
import type { SheetEntryInput } from './use-character-sheet-entries';
import {
  usePersonalAdjustmentForm,
  type PersonalAdjustmentSaveOutcome,
} from './use-personal-adjustment-form';

function wholeNumber(raw: string) {
  return /^\d+$/.test(raw.trim()) && Number.isSafeInteger(Number(raw));
}
const schema = z
  .object({
    kind: z.enum(['spellEffect', 'condition', 'item', 'spell']),
    lastsOverOneDay: z.boolean(),
    consumable: z.boolean(),
    defaultCasterLevel: z.string(),
    casterLevel: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== 'spellEffect') return;
    if (!value.defaultCasterLevel.trim())
      ctx.addIssue({
        code: 'custom',
        path: ['defaultCasterLevel'],
        message: 'Default caster level is required',
      });
    else if (!wholeNumber(value.defaultCasterLevel))
      ctx.addIssue({
        code: 'custom',
        path: ['defaultCasterLevel'],
        message: 'Default caster level must be a whole number of 0 or more',
      });
    if (value.casterLevel.trim() && !wholeNumber(value.casterLevel))
      ctx.addIssue({
        code: 'custom',
        path: ['casterLevel'],
        message: 'Caster level must be a whole number of 0 or more',
      });
  });

function formValues(value?: SheetEntryInput) {
  const detail = value?.detail;
  return {
    kind: detail?.kind ?? 'condition',
    lastsOverOneDay: detail?.kind === 'spellEffect' && detail.lastsOverOneDay,
    consumable: detail?.kind === 'item' && detail.consumable,
    defaultCasterLevel: String(
      detail?.kind === 'spellEffect' ? detail.defaultCasterLevel : 1,
    ),
    casterLevel:
      detail?.kind === 'spellEffect'
        ? String(value?.casterLevel ?? detail.defaultCasterLevel)
        : '',
  };
}

function classificationDetail(
  classification: z.infer<typeof schema>,
): SheetEntryInput['detail'] {
  if (classification.kind === 'spellEffect')
    return {
      kind: 'spellEffect',
      lastsOverOneDay: classification.lastsOverOneDay,
      defaultCasterLevel: Number(classification.defaultCasterLevel),
    };
  if (classification.kind === 'item')
    return { kind: 'item', consumable: classification.consumable };
  return { kind: classification.kind };
}

export function useSheetEntryForm({
  value,
  save: write,
}: {
  value?: SheetEntryInput;
  save: (input: SheetEntryInput) => Promise<unknown>;
}) {
  const state = useSheetFormState({
    incoming: formValues(value),
    resolver: zodResolver(schema),
    draftPolicy: 'fields',
  });
  const { form, source, baseline, setBaseline, expected, latest } = state;
  const adjustment = usePersonalAdjustmentForm({
    adjustment: value,
    save: async (input) => {
      const classification = schema.parse(form.getValues());
      const detail = classificationDetail(classification);
      const submitted = {
        ...input,
        detail,
        ...(detail.kind === 'spellEffect'
          ? {
              casterLevel: classification.casterLevel.trim()
                ? Number(classification.casterLevel)
                : detail.defaultCasterLevel,
            }
          : {}),
      };
      expected.current = JSON.stringify(formValues(submitted));
      try {
        await write(submitted);
      } catch (error) {
        expected.current = null;
        throw error;
      }
    },
  });
  async function save(): Promise<PersonalAdjustmentSaveOutcome> {
    let outcome: PersonalAdjustmentSaveOutcome = 'failed';
    await form.handleSubmit(async (values) => {
      const normalized = formValues({
        name: '',
        modifiers: [],
        detail: classificationDetail(values),
        ...(values.kind === 'spellEffect'
          ? {
              casterLevel: values.casterLevel.trim()
                ? Number(values.casterLevel)
                : Number(values.defaultCasterLevel),
            }
          : {}),
      });
      outcome =
        JSON.stringify(normalized) === JSON.stringify(baseline)
          ? await adjustment.save()
          : await adjustment.saveAdditionalChanges();
      if (outcome === 'saved') {
        const current = form.getValues();
        const next =
          latest.current.source === source
            ? normalized
            : latest.current.baseline;
        setBaseline(next);
        // Canonical values identify unchanged saves; raw accepted values keep
        // a blank default from becoming a local edit when its echo arrives.
        const accepted = latest.current.source === source ? values : next;
        const retained =
          latest.current.source !== source &&
          JSON.stringify(next) === JSON.stringify(normalized) &&
          JSON.stringify(current) === JSON.stringify(values)
            ? next
            : current;
        form.reset(accepted, { keepDirtyValues: false });
        form.reset(retained, {
          keepDefaultValues: true,
          keepDirtyValues: false,
        });
      }
    })();
    return outcome;
  }
  return {
    form,
    adjustmentForm: adjustment.form,
    fields: adjustment.fields,
    addModifier: adjustment.addModifier,
    removeModifier: adjustment.removeModifier,
    status: adjustment.status,
    hasRemoteChange: state.hasRemoteChange || adjustment.hasRemoteChange,
    dismissRemoteChange: () => {
      state.dismissRemoteChange();
      adjustment.dismissRemoteChange();
    },
    save,
  };
}
