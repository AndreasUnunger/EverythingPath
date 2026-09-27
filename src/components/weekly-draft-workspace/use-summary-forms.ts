'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { ReviewException } from '~/components/week-review/review-facts';
import { moveAdjustmentById } from './adjustment-order';
import {
  adjustmentChoices,
  adjustmentFormSchema,
  adjustmentFormValues,
  adjustmentKinds,
  appendAdjustment,
  removeAdjustment,
  replaceAdjustment,
  savedAdjustment,
  type AdjustmentBody,
  type AdjustmentFormValues,
  type AdjustmentKind,
  type AdjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';

// The live Summary's local forms: Table Adjustments and Rules Exception
// reasons. Raw input stays on this device until a valid Save; the accepted
// value is kept meanwhile. Every open or invalid form registers with the
// Workspace's Confirm guard so this device cannot confirm the old accepted
// value by accident. Saves send one existing semantic edit built from the
// latest known state, never a list captured when the form opened.

export type Edit = (edit: WeeklyDraftEdit) => Promise<'accepted' | 'failed'>;
/** The Workspace's Confirm guard: a message while open, null when done. */
export type RegisterLocalForm = (
  id: string,
  form: { message: string } | null,
) => void;

/** Keeps one local form's registration current and removes it on unmount. */
export function useLocalFormRegistration(
  register: RegisterLocalForm | undefined,
  id: string,
  message: string | null,
) {
  useEffect(() => {
    register?.(id, message === null ? null : { message });
  }, [register, id, message]);
  useEffect(() => () => register?.(id, null), [register, id]);
}

/** Focuses a registered local form: its first invalid field, else its first control. */
export function focusLocalForm(id: string) {
  const form = document.getElementById(localFormElementId(id));
  const target =
    form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
    form?.querySelector<HTMLElement>('input, textarea, button');
  target?.focus();
}
export const localFormElementId = (id: string) => `review-form-${id}`;

/**
 * This device's own Save moves the optimistic forecast, and a failed Save
 * moves it back; neither is another player's change to the accepted value.
 */
function useOwnSaveTracking() {
  const [tracking] = useState(() => {
    let saving = false;
    let settledTo: string | null | undefined;
    return {
      async save(
        before: string | null,
        run: () => Promise<'accepted' | 'failed'>,
      ) {
        saving = true;
        let result: 'accepted' | 'failed' = 'failed';
        try {
          result = await run();
          return result;
        } finally {
          saving = false;
          // A failed Save rolls the forecast back to the earlier value,
          // possibly only after this point.
          settledTo = result === 'failed' ? before : undefined;
        }
      },
      /** Whether an accepted value change came from this device's Save. */
      explains(next: string | null) {
        if (saving) return true;
        if (settledTo === undefined) return false;
        const rollback = next === settledTo;
        settledTo = undefined;
        return rollback;
      },
    };
  });
  return tracking;
}

const kindLabel = (kind: AdjustmentKind) =>
  adjustmentKinds.find((item) => item.value === kind)!.label;

/**
 * One Table Adjustment form: an existing adjustment (inline reason plus the
 * full editor) or a new one of a chosen kind.
 */
export function useAdjustmentForm({
  adjustmentId,
  accepted,
  kind,
  initialValues,
  number,
  effect,
  targets,
  latest,
  edit,
  register,
  onSaved,
  onCancelled,
  onRemovedElsewhere,
}: {
  adjustmentId: string;
  /** The accepted adjustment; null for a new one. */
  accepted: TableAdjustment | null;
  kind: AdjustmentKind;
  /** Raw values to start from instead of the accepted/empty ones (recovery). */
  initialValues?: AdjustmentFormValues;
  /** 1-based position and effect text of an existing adjustment, for messages. */
  number?: number;
  effect?: string;
  targets: AdjustmentTargets;
  /** The latest ordered list this device knows, read at Save time. */
  latest: () => readonly TableAdjustment[];
  edit: Edit;
  register?: RegisterLocalForm;
  onSaved?: () => void;
  onCancelled?: () => void;
  /**
   * The existing adjustment left the list while this form held unsaved
   * input and this device did not remove it: the input to keep.
   */
  onRemovedElsewhere?: (draft: RemovedAdjustmentDraft) => void;
}) {
  const isNew = accepted === null;
  const acceptedValues = useMemo(
    () => (accepted ? adjustmentFormValues(accepted) : null),
    // The accepted adjustment is a fresh copy on every publication.
    [JSON.stringify(accepted)],
  );
  const [initial] = useState(
    () => initialValues ?? acceptedValues ?? adjustmentFormValues({ kind }),
  );
  const choices = useMemo(
    () => adjustmentChoices(targets, acceptedValues ?? initial),
    [targets, acceptedValues, initial],
  );
  const choicesRef = useRef(choices);
  choicesRef.current = choices;
  const resolver = useMemo<
    Resolver<AdjustmentFormValues, unknown, AdjustmentBody>
  >(
    () => (values, context, options) =>
      zodResolver(adjustmentFormSchema(choicesRef.current))(
        values,
        context,
        options,
      ),
    [],
  );
  const form = useForm<AdjustmentFormValues, unknown, AdjustmentBody>({
    defaultValues: initial,
    resolver,
    mode: 'onChange',
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const { isDirty, isValid, errors } = form.formState;
  // Accepted changes from elsewhere refresh an untouched form; a form with
  // local input keeps it and says the accepted value changed underneath.
  const acceptedKey = acceptedValues ? JSON.stringify(acceptedValues) : null;
  const base = useRef(acceptedKey);
  const own = useOwnSaveTracking();
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  useEffect(() => {
    if (acceptedKey === base.current || !acceptedValues) return;
    base.current = acceptedKey;
    if (own.explains(acceptedKey)) return;
    if (dirtyRef.current) setRemoteChanged(true);
    else form.reset(acceptedValues);
  }, [acceptedKey, acceptedValues, form, own]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const subject = isNew
    ? `New ${kindLabel(kind)} adjustment`
    : `Table Adjustment ${number ?? ''} “${effect ?? kindLabel(kind)}”`;
  const onlyReason =
    !isValid &&
    errors.reason !== undefined &&
    Object.keys(errors).every((key) => key === 'reason');
  const message =
    !isNew && !isDirty
      ? null
      : onlyReason
        ? `${subject} needs a reason.`
        : !isValid && Object.keys(errors).length
          ? `${subject}: fix the highlighted fields, then save or cancel.`
          : isNew
            ? `${subject}: save or cancel it.`
            : `${subject}: save or cancel your changes.`;
  const formId = `${isNew ? 'new-adjustment' : 'adjustment'}:${adjustmentId}`;
  useLocalFormRegistration(register, formId, message);
  // An existing row unmounts when its adjustment leaves the list. Unsaved
  // input then survives as a removed-adjustment draft, unless this device
  // removed it.
  const removing = useRef(false);
  const leaving = useRef({ subject, onRemovedElsewhere });
  leaving.current = { subject, onRemovedElsewhere };
  useEffect(
    () => () => {
      if (isNew || removing.current || !dirtyRef.current) return;
      leaving.current.onRemovedElsewhere?.({
        adjustmentId,
        subject: leaving.current.subject,
        values: form.getValues(),
      });
    },
    [isNew, adjustmentId, form],
  );

  const submit = form.handleSubmit(async (body) => {
    const adjustment = savedAdjustment(body, adjustmentId);
    if (!adjustment) return;
    const next = isNew
      ? appendAdjustment(latest(), adjustment)
      : replaceAdjustment(latest(), adjustment);
    if (!next) {
      setFailure(
        'Another player removed this adjustment. Cancel, or add it again as a new adjustment.',
      );
      return;
    }
    const submitted = form.getValues();
    setSaving(true);
    setFailure(null);
    const result = await own.save(base.current, () =>
      edit({ kind: 'table_adjustments', adjustments: next }),
    );
    if (!mounted.current) return;
    setSaving(false);
    if (result === 'accepted') {
      // Input typed while saving stays as a further unsaved change.
      form.reset(submitted, { keepValues: true });
      setRemoteChanged(false);
      onSaved?.();
    } else
      setFailure(
        'The adjustment could not be saved. Your change is kept here; check the current adjustments, then save again or cancel.',
      );
  });
  function cancel() {
    form.reset(acceptedValues ?? adjustmentFormValues({ kind }));
    setFailure(null);
    setRemoteChanged(false);
    onCancelled?.();
  }
  return {
    form,
    formId,
    elementId: localFormElementId(formId),
    choices,
    submit,
    cancel,
    /** Call before this device removes the adjustment: its input is dropped. */
    markRemoving(value = true) {
      removing.current = value;
    },
    /** Local input differs from the accepted adjustment (always true when new). */
    dirty: isNew || isDirty,
    saving,
    failure,
    /** Another player changed this adjustment while this form held input. */
    remoteChanged,
  };
}
export type AdjustmentForm = ReturnType<typeof useAdjustmentForm>;

/** Ordering and removal of the accepted list, always from the latest list. */
export function useAdjustmentListEdits({
  latest,
  edit,
}: {
  latest: () => readonly TableAdjustment[];
  edit: Edit;
}) {
  return {
    move: (adjustmentId: string, offset: -1 | 1) => {
      const next = moveAdjustmentById(latest(), adjustmentId, offset);
      return next
        ? edit({ kind: 'table_adjustments', adjustments: next })
        : Promise.resolve('failed' as const);
    },
    remove: (adjustmentId: string) => {
      return edit({
        kind: 'table_adjustments',
        adjustments: removeAdjustment(latest(), adjustmentId),
      });
    },
  };
}

/**
 * An adjustment another player removed while this device held unsaved
 * changes to it: kept locally until added again or discarded.
 */
export type RemovedAdjustmentDraft = {
  adjustmentId: string;
  subject: string;
  values: AdjustmentFormValues;
};

export function useRemovedAdjustmentDrafts() {
  const [drafts, setDrafts] = useState<RemovedAdjustmentDraft[]>([]);
  return {
    drafts,
    keep: (draft: RemovedAdjustmentDraft) => {
      setDrafts((current) => [
        ...current.filter((item) => item.adjustmentId !== draft.adjustmentId),
        draft,
      ]);
    },
    discard: (adjustmentId: string) => {
      setDrafts((current) =>
        current.filter((item) => item.adjustmentId !== adjustmentId),
      );
    },
  };
}

/** Registers one kept removed-adjustment draft with the Confirm guard. */
export function useRemovedDraftRegistration(
  register: RegisterLocalForm | undefined,
  draft: RemovedAdjustmentDraft,
) {
  const id = `removed-adjustment:${draft.adjustmentId}`;
  useLocalFormRegistration(
    register,
    id,
    `${draft.subject} was removed by another player. Add your version again or discard it.`,
  );
  return { formId: id, elementId: localFormElementId(id) };
}

const reasonSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required.'),
});

/**
 * A Rules Exception's reason: edited locally, saved with `rules_exception`
 * (identity, subject and rule preserved) or cleared with
 * `clear_rules_exception`, which revokes the permission. A blank reason is
 * never saved.
 */
export function useExceptionReasonForm({
  note,
  subject,
  edit,
  register,
}: {
  note: ReviewException;
  /** Readable subject of the exception, e.g. "Activity 2: Earn Gold". */
  subject: string;
  edit: Edit;
  register?: RegisterLocalForm;
}) {
  const form = useForm<{ reason: string }, unknown, { reason: string }>({
    defaultValues: { reason: note.reason },
    resolver: zodResolver(reasonSchema),
    mode: 'onChange',
  });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const { isDirty, isValid } = form.formState;
  const base = useRef<string | null>(note.reason);
  const own = useOwnSaveTracking();
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;
  useEffect(() => {
    if (note.reason === base.current) return;
    base.current = note.reason;
    if (own.explains(note.reason)) return;
    if (dirtyRef.current) setRemoteChanged(true);
    else form.reset({ reason: note.reason });
  }, [note.reason, form, own]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const label = `${subject} · ${note.rule}`;
  const formId = `exception:${note.exceptionId}`;
  useLocalFormRegistration(
    register,
    formId,
    !isDirty
      ? null
      : isValid
        ? `${label}: save or cancel the new reason.`
        : `${label} exception needs a reason. Save one, cancel, or clear the exception.`,
  );
  const submit = form.handleSubmit(async ({ reason }) => {
    const submitted = form.getValues();
    setSaving(true);
    setFailure(null);
    const result = await own.save(base.current, () =>
      edit({
        kind: 'rules_exception',
        exception: {
          exceptionId: note.exceptionId,
          subjectId: note.subjectId,
          ruleId: note.ruleId,
          reason,
        },
      }),
    );
    if (!mounted.current) return;
    setSaving(false);
    if (result === 'accepted') {
      form.reset(submitted, { keepValues: true });
      setRemoteChanged(false);
    } else
      setFailure(
        'The reason could not be saved. Your text is kept here; save again or cancel.',
      );
  });
  function cancel() {
    form.reset({ reason: note.reason });
    setFailure(null);
    setRemoteChanged(false);
  }
  function clear() {
    return edit({
      kind: 'clear_rules_exception',
      exceptionId: note.exceptionId,
    });
  }
  return {
    form,
    formId,
    elementId: localFormElementId(formId),
    submit,
    cancel,
    clear,
    dirty: isDirty,
    saving,
    failure,
    remoteChanged,
  };
}
export type ExceptionReasonForm = ReturnType<typeof useExceptionReasonForm>;
