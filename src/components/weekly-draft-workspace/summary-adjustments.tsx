'use client';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import type { ReviewAdjustment } from '~/components/week-review/review-facts';
import { wrap } from '~/components/week-review/review-parts';
import { cn } from '~/lib/utils';
import {
  AdjustmentFields,
  FormNotes,
  ReasonField,
} from './summary-adjustment-fields';
import {
  adjustmentKinds,
  type AdjustmentFormValues,
  type AdjustmentKind,
  type AdjustmentTargets,
  type TableAdjustment,
} from './summary-adjustment-form';
import {
  useAdjustmentForm,
  useAdjustmentListEdits,
  useRemovedDraftRegistration,
  type Edit,
  type RegisterLocalForm,
  type RemovedAdjustmentDraft,
  type useRemovedAdjustmentDrafts,
} from './use-summary-forms';

// The live Summary's Table Adjustment controls: one editable row per
// adjustment and the kind cards that open a new one. Values, validation and
// saving live in the form hooks; this file lays them out.

type ListProps = {
  targets: AdjustmentTargets;
  latest: () => readonly TableAdjustment[];
  edit: Edit;
  register?: RegisterLocalForm;
  disabled: boolean;
};

const remoteChangedRow =
  'Another player changed this adjustment. Your unsaved changes are kept: Save replaces theirs, Cancel shows theirs.';

/** Runs after React has applied the change a saved edit produces. */
const afterRender = (run: () => void) => setTimeout(run, 0);

const firstControl = (root: Element | null | undefined) =>
  root?.querySelector<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)',
  ) ?? null;

/** One existing adjustment: order, reason, the full editor and removal. */
export function AdjustmentRow({
  adjustment,
  index,
  count,
  accepted,
  targets,
  latest,
  edit,
  register,
  disabled,
  onRemovedElsewhere,
}: ListProps & {
  adjustment: ReviewAdjustment;
  index: number;
  count: number;
  accepted: TableAdjustment;
  onRemovedElsewhere: (draft: RemovedAdjustmentDraft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const earlierRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const f = useAdjustmentForm({
    adjustmentId: adjustment.adjustmentId,
    accepted,
    kind: accepted.kind,
    number: adjustment.number,
    effect: adjustment.effect,
    targets,
    latest,
    edit,
    register,
    onRemovedElsewhere,
    onSaved: () => setEditing(false),
    onCancelled: () => setEditing(false),
  });
  const { move, remove } = useAdjustmentListEdits({ latest, edit });
  const n = adjustment.number;
  const reason = f.form.watch('reason');
  const showActions = editing || f.dirty;

  async function moveBy(offset: -1 | 1) {
    const pressed = offset === -1 ? earlierRef : laterRef;
    const other = offset === -1 ? laterRef : earlierRef;
    if ((await move(adjustment.adjustmentId, offset)) !== 'accepted') return;
    // React moves the keyed row's node, which blurs it: keep the same button
    // focused, or its neighbour once this one is at the end of the list.
    afterRender(() => {
      const target = pressed.current?.disabled
        ? other.current
        : pressed.current;
      target?.focus();
    });
  }

  async function removeRow() {
    const item = formRef.current?.closest('li');
    const neighbour = item?.nextElementSibling ?? item?.previousElementSibling;
    const section = formRef.current?.closest('section');
    f.markRemoving();
    if ((await remove(adjustment.adjustmentId)) === 'failed') {
      f.markRemoving(false);
      return;
    }
    afterRender(() => {
      const target =
        (neighbour?.isConnected ? firstControl(neighbour) : null) ??
        firstControl(
          section?.querySelector(
            '[role="group"][aria-label="New Table Adjustment"]',
          ),
        );
      target?.focus();
    });
  }

  const moveButton = (
    ref: typeof earlierRef,
    offset: -1 | 1,
    Icon: typeof ArrowUp,
  ) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Move adjustment ${n} ${offset === -1 ? 'earlier' : 'later'}`}
      disabled={disabled || (offset === -1 ? index === 0 : index === count - 1)}
      onClick={() => void moveBy(offset)}
    >
      <Icon aria-hidden />
    </Button>
  );

  return (
    <form
      ref={formRef}
      noValidate
      id={f.elementId}
      aria-label={`Adjustment ${n} editor`}
      onSubmit={f.submit}
      className={cn(
        'grid items-start gap-2',
        count > 1
          ? 'grid-cols-[auto_minmax(0,1fr)_auto]'
          : 'grid-cols-[minmax(0,1fr)_auto]',
      )}
    >
      {count > 1 && (
        <div className="flex gap-1 sm:flex-col">
          {moveButton(earlierRef, -1, ArrowUp)}
          {moveButton(laterRef, 1, ArrowDown)}
        </div>
      )}
      <div className="flex justify-end gap-1 sm:order-last">
        <Button
          ref={editRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Edit adjustment ${n}`}
          aria-expanded={editing}
          aria-controls={`${f.elementId}-fields`}
          disabled={disabled}
          onClick={() => setEditing((open) => !open)}
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove adjustment ${n}`}
          disabled={disabled}
          onClick={() => void removeRow()}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <div
        className={cn(
          'min-w-0 space-y-2 sm:row-start-1',
          count > 1
            ? 'col-span-3 sm:col-span-1 sm:col-start-2'
            : 'col-span-2 sm:col-span-1',
        )}
      >
        <div id={`${f.elementId}-fields`} hidden={!editing}>
          {editing && <AdjustmentFields form={f} disabled={disabled} />}
        </div>
        <ReasonField
          label={`Reason for adjustment ${n}`}
          registration={f.form.register('reason')}
          blank={reason.trim() === ''}
          error={f.form.formState.errors.reason}
          disabled={disabled}
          onEnter={() => {
            if (f.dirty && !f.saving) void f.submit();
          }}
        />
        <FormNotes
          failure={f.failure}
          remoteChanged={f.remoteChanged}
          remoteMessage={remoteChangedRow}
        />
        {showActions && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={disabled || f.saving}
              aria-busy={f.saving || undefined}
            >
              <Check aria-hidden />
              {f.saving ? 'Saving…' : `Save adjustment ${n}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                f.cancel();
                editRef.current?.focus();
              }}
            >
              Cancel changes to adjustment {n}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

type NewAdjustment = {
  id: string;
  kind: AdjustmentKind;
  initialValues?: AdjustmentFormValues;
};

function NewAdjustmentForm({
  open,
  label,
  targets,
  latest,
  edit,
  register,
  disabled,
  onClose,
}: ListProps & {
  open: NewAdjustment;
  label: string;
  onClose: () => void;
}) {
  const f = useAdjustmentForm({
    adjustmentId: open.id,
    accepted: null,
    kind: open.kind,
    initialValues: open.initialValues,
    targets,
    latest,
    edit,
    register,
    onSaved: onClose,
    onCancelled: onClose,
  });
  const reason = f.form.watch('reason');
  return (
    <form
      noValidate
      id={f.elementId}
      aria-label={`New ${label} adjustment`}
      onSubmit={f.submit}
      className="min-w-0 space-y-3 border p-3"
    >
      <p className="text-sm font-semibold">{label}</p>
      <AdjustmentFields form={f} disabled={disabled} />
      <ReasonField
        label="Reason"
        registration={f.form.register('reason')}
        blank={reason.trim() === ''}
        error={f.form.formState.errors.reason}
        disabled={disabled}
        onEnter={() => {
          if (!f.saving) void f.submit();
        }}
      />
      <FormNotes
        failure={f.failure}
        remoteChanged={f.remoteChanged}
        remoteMessage={remoteChangedRow}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={disabled || f.saving}
          aria-busy={f.saving || undefined}
        >
          <Check aria-hidden />
          {f.saving ? 'Saving…' : 'Save adjustment'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={f.cancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemovedDraftCard({
  draft,
  register,
  disabled,
  onAddAgain,
  onDiscard,
}: {
  draft: RemovedAdjustmentDraft;
  register?: RegisterLocalForm;
  disabled: boolean;
  onAddAgain: () => void;
  onDiscard: () => void;
}) {
  const { elementId } = useRemovedDraftRegistration(register, draft);
  return (
    <div
      id={elementId}
      role="status"
      className="min-w-0 space-y-2 border border-amber-500/60 p-3"
    >
      <p className={cn('text-sm', wrap)}>
        {draft.subject} was removed by another player. Your unsaved changes are
        kept.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onAddAgain}
        >
          Add again as a new adjustment
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onDiscard}
        >
          Discard changes
        </Button>
      </div>
    </div>
  );
}

/** Kind cards, the form that appends a new adjustment and kept removed drafts. */
export function AddAdjustment({
  targets,
  latest,
  edit,
  register,
  disabled,
  drafts,
}: ListProps & { drafts: ReturnType<typeof useRemovedAdjustmentDrafts> }) {
  const [open, setOpen] = useState<NewAdjustment | null>(null);
  const cardRefs = useRef(new Map<AdjustmentKind, HTMLButtonElement>());
  const describedBy = useId();
  const openLabel = open
    ? adjustmentKinds.find((item) => item.value === open.kind)!.label
    : null;
  const close = () => {
    const kind = open?.kind;
    setOpen(null);
    if (kind) cardRefs.current.get(kind)?.focus();
  };
  return (
    <div className="min-w-0 space-y-3">
      {drafts.drafts.map((draft) => (
        <RemovedDraftCard
          key={draft.adjustmentId}
          draft={draft}
          register={register}
          disabled={disabled}
          onAddAgain={() => {
            setOpen({
              id: crypto.randomUUID(),
              kind: draft.values.kind,
              initialValues: draft.values,
            });
            drafts.discard(draft.adjustmentId);
          }}
          onDiscard={() => drafts.discard(draft.adjustmentId)}
        />
      ))}
      <div
        role="group"
        aria-label="New Table Adjustment"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {adjustmentKinds.map((kind) => {
          const pressed = open?.kind === kind.value;
          const noteId = `${describedBy}-${kind.value}`;
          return (
            // Hover only lifts and tints the border so it never resembles the
            // open kind's fill.
            <button
              key={kind.value}
              ref={(node) => {
                if (node) cardRefs.current.set(kind.value, node);
                else cardRefs.current.delete(kind.value);
              }}
              type="button"
              aria-label={kind.label}
              aria-describedby={noteId}
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => {
                if (pressed) return;
                setOpen({ id: crypto.randomUUID(), kind: kind.value });
              }}
              className={cn(
                // Words wrap between each other, never inside one: the label
                // shrinks on a phone instead of splitting "Settlement".
                'bg-background flex h-auto min-h-16 max-w-full min-w-0 flex-col items-start gap-1 rounded-lg border-2 p-2.5 text-left break-normal whitespace-normal transition-transform select-none sm:p-3',
                'hover:border-primary/60 hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:transform-none',
                'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
                'disabled:pointer-events-none disabled:opacity-50',
                pressed
                  ? 'border-primary bg-primary/15 hover:border-primary'
                  : 'border-border',
              )}
            >
              <span className="flex w-full min-w-0 items-start gap-1.5 text-xs font-semibold sm:text-sm">
                {pressed ? (
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <Plus aria-hidden className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="min-w-0 break-normal">{kind.label}</span>
              </span>
              <span
                id={noteId}
                className="text-muted-foreground min-w-0 text-xs font-normal"
              >
                {kind.description}
              </span>
            </button>
          );
        })}
      </div>
      {open && openLabel && (
        <NewAdjustmentForm
          key={open.id}
          open={open}
          label={openLabel}
          targets={targets}
          latest={latest}
          edit={edit}
          register={register}
          disabled={disabled}
          onClose={close}
        />
      )}
    </div>
  );
}
