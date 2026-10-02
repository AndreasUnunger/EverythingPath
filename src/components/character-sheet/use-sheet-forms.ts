'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import {
  useForm,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';
import {
  abilityKeys,
  abilityLabels,
  defaultCreationSettings,
  type CreationSettings,
} from '~/lib/character-sheet';
import { classifyWriteFailure, refusalReason } from '~/lib/write-outcome';
import type { SaveStatus } from './save-status';

const numberPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;

function buildNumberField(label: string, isOptional = false) {
  return z.string().superRefine((raw, context) => {
    const value = raw.trim();
    if (!value) {
      if (!isOptional)
        context.addIssue({ code: 'custom', message: `${label} is required` });
      return;
    }
    if (!numberPattern.test(value) || !Number.isFinite(Number(value))) {
      context.addIssue({
        code: 'custom',
        message: `${label} must be a number`,
      });
    }
  });
}

function buildNonnegativeIntegerField(label: string) {
  return buildNumberField(label).pipe(
    z
      .string()
      .refine(
        (value) => Number.isInteger(Number(value)) && Number(value) >= 0,
        `${label} must be a whole number of 0 or more`,
      ),
  );
}

function isSameNumber(left: unknown, right: unknown) {
  if (left === right) return true;
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (!left.trim() || !right.trim()) return left.trim() === right.trim();
  return (
    numberPattern.test(left.trim()) &&
    numberPattern.test(right.trim()) &&
    Number.isFinite(Number(left)) &&
    Number(left) === Number(right)
  );
}

function resetToAccepted<T extends FieldValues>(
  form: UseFormReturn<T>,
  next: T,
) {
  const current = form.getValues();
  for (const key in current) {
    if (isSameNumber(current[key], next[key])) current[key] = next[key];
  }
  // Formatting alone is not a new choice. Keep genuinely newer input dirty.
  form.reset(next, { keepErrors: true, keepDirtyValues: false });
  form.reset(current, {
    keepDefaultValues: true,
    keepErrors: true,
    keepDirtyValues: false,
  });
}

const hpSchema = z.object({ hpGained: buildNumberField('Hit points', true) });

// A mounted editor belongs to one stable sheet entry. Reactive values refresh
// pristine fields; react-hook-form retains dirty fields and their errors.
function useSheetForm<T extends FieldValues>({
  values,
  resolver,
  write,
}: {
  values: T;
  resolver: Resolver<T>;
  write: (changes: Partial<T>, submitted: T) => Promise<void>;
}) {
  const [source, setSource] = useState(values);
  const [baseline, setBaseline] = useState(values);
  const [hasRemoteChange, setHasRemoteChange] = useState(false);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const expected = useRef<Partial<T>>({});
  const isBusy = useRef(false);
  const latestBaseline = useRef(baseline);
  latestBaseline.current = baseline;
  const latestSource = useRef(source);
  latestSource.current = source;
  const form = useForm<T>({
    values: baseline,
    resolver,
    resetOptions: { keepDirtyValues: true, keepErrors: true },
  });
  // Subscribe even if the presentation only reads errors, so keepDirtyValues
  // knows which fields must survive a subscription update.
  void form.formState.dirtyFields;
  void form.formState.errors;
  if (Object.keys(values).some((key) => values[key] !== source[key])) {
    const next = { ...baseline };
    let hasRemoteChanges = false;
    for (const key in values) {
      if (values[key] === source[key]) continue;
      next[key] = values[key];
      if (isSameNumber(expected.current[key], values[key])) {
        delete expected.current[key];
      } else hasRemoteChanges = true;
    }
    setSource(values);
    setBaseline(next);
    if (hasRemoteChanges) setHasRemoteChange(true);
  }

  async function submit(valuesToSave: T) {
    const changes: Partial<T> = {};
    for (const key in valuesToSave) {
      if (!isSameNumber(valuesToSave[key], baseline[key]))
        changes[key] = valuesToSave[key];
    }
    if (Object.keys(changes).length === 0) {
      resetToAccepted(form, latestBaseline.current);
      if (status.kind === 'error') setStatus({ kind: 'idle' });
      return;
    }
    expected.current = { ...expected.current, ...changes };
    setStatus({ kind: 'saving' });
    try {
      await write(changes, valuesToSave);
      const next = { ...latestBaseline.current };
      for (const key in changes) {
        if (latestSource.current[key] === source[key])
          next[key] = valuesToSave[key];
      }
      resetToAccepted(form, next);
      setBaseline(next);
      setStatus({ kind: 'saved' });
    } catch (error) {
      const failure = classifyWriteFailure(error);
      if (
        failure.kind === 'unknown' &&
        Object.keys(changes).every((key) => expected.current[key] === undefined)
      ) {
        resetToAccepted(form, latestBaseline.current);
        setStatus({ kind: 'saved' });
        return;
      }
      expected.current = {};
      setStatus({
        kind: 'error',
        message:
          failure.kind === 'rejected'
            ? `Changes weren't saved${refusalReason(failure.message)} Your edits are kept. Save to try again.`
            : 'Changes may not have been saved. Your edits are kept. Check them, then Save to try again.',
      });
    }
  }

  async function save() {
    if (isBusy.current) return;
    isBusy.current = true;
    try {
      await form.handleSubmit(submit)();
    } finally {
      isBusy.current = false;
    }
  }

  return {
    form,
    status,
    hasRemoteChange,
    save,
    dismissRemoteChange: () => setHasRemoteChange(false),
  };
}

export function useClassLevelForm({
  hpGained,
  save,
}: {
  hpGained: number | null;
  save: (hpGained: number | null) => Promise<void>;
}) {
  return useSheetForm({
    values: { hpGained: hpGained === null ? '' : String(hpGained) },
    resolver: zodResolver(hpSchema),
    write: async (changes) => {
      if (changes.hpGained !== undefined)
        await save(
          changes.hpGained.trim() === '' ? null : Number(changes.hpGained),
        );
    },
  });
}

const baseScoresSchema = z.object({
  strength: buildNumberField(abilityLabels.strength),
  dexterity: buildNumberField(abilityLabels.dexterity),
  constitution: buildNumberField(abilityLabels.constitution),
  intelligence: buildNumberField(abilityLabels.intelligence),
  wisdom: buildNumberField(abilityLabels.wisdom),
  charisma: buildNumberField(abilityLabels.charisma),
});

type BaseScoreValues = z.infer<typeof baseScoresSchema>;
type Scores = { [Key in keyof BaseScoreValues]: number };

export function useBaseScoresForm({
  scores,
  save,
}: {
  scores: Scores;
  save: (changes: Partial<Scores>) => Promise<void>;
}) {
  return useSheetForm({
    values: {
      strength: String(scores.strength),
      dexterity: String(scores.dexterity),
      constitution: String(scores.constitution),
      intelligence: String(scores.intelligence),
      wisdom: String(scores.wisdom),
      charisma: String(scores.charisma),
    },
    resolver: zodResolver(baseScoresSchema),
    write: async (changes) => {
      const patch: Partial<Scores> = {};
      for (const key of abilityKeys) {
        if (changes[key] !== undefined) patch[key] = Number(changes[key]);
      }
      await save(patch);
    },
  });
}

const creationSettingsSchema = z
  .object({
    abilityMethod: z.enum(['pointBuy', 'rolled']),
    pointBuyBudget: z.string(),
    traitCount: buildNonnegativeIntegerField('Trait count'),
    campaignTraitRequired: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.abilityMethod !== 'pointBuy') return;
    const budget = buildNonnegativeIntegerField('Point-buy budget').safeParse(
      values.pointBuyBudget,
    );
    if (!budget.success) {
      for (const issue of budget.error.issues) {
        context.addIssue({
          code: 'custom',
          path: ['pointBuyBudget'],
          message: issue.message,
        });
      }
    }
  });

export function useCreationSettingsForm({
  settings,
  save,
}: {
  settings: CreationSettings;
  save: (changes: Partial<CreationSettings>) => Promise<void>;
}) {
  const budget =
    settings.abilityMethod.budget ??
    defaultCreationSettings.abilityMethod.budget;
  return useSheetForm({
    values: {
      abilityMethod: settings.abilityMethod.kind,
      pointBuyBudget: String(budget),
      traitCount: String(settings.traitCount),
      campaignTraitRequired: settings.campaignTraitRequired,
    },
    resolver: zodResolver(creationSettingsSchema),
    write: async (changes, submitted) => {
      const patch: Partial<CreationSettings> = {};
      if (
        changes.abilityMethod !== undefined ||
        changes.pointBuyBudget !== undefined
      ) {
        const kind = submitted.abilityMethod;
        const validBudget = buildNonnegativeIntegerField(
          'Point-buy budget',
        ).safeParse(submitted.pointBuyBudget);
        patch.abilityMethod =
          kind === 'rolled'
            ? {
                kind,
                budget: validBudget.success
                  ? Number(submitted.pointBuyBudget)
                  : budget,
              }
            : { kind, budget: Number(submitted.pointBuyBudget) };
      }
      if (changes.traitCount !== undefined)
        patch.traitCount = Number(changes.traitCount);
      if (changes.campaignTraitRequired !== undefined)
        patch.campaignTraitRequired = changes.campaignTraitRequired;
      await save(patch);
    },
  });
}
