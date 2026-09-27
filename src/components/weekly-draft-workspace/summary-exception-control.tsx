'use client';
import { Check, X } from 'lucide-react';
import { Button } from '~/components/ui/button';
import type { ReviewException } from '~/components/week-review/review-facts';
import { FormNotes, ReasonField } from './summary-adjustment-fields';
import {
  useExceptionReasonForm,
  type Edit,
  type RegisterLocalForm,
} from './use-summary-forms';

/** The live Summary's controls under a Rules Exception: reason editor or removal. */
export function ExceptionControl({
  note,
  subject,
  edit,
  register,
  disabled,
}: {
  note: ReviewException;
  /** Readable subject of the exception, e.g. "Activity 2: Earn Gold". */
  subject: string;
  edit: Edit;
  register?: RegisterLocalForm;
  disabled: boolean;
}) {
  if (note.obsolete)
    return (
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() =>
          void edit({
            kind: 'clear_rules_exception',
            exceptionId: note.exceptionId,
          })
        }
      >
        Remove obsolete exception
      </Button>
    );
  return (
    <ExceptionReasonForm
      note={note}
      subject={subject}
      edit={edit}
      register={register}
      disabled={disabled}
    />
  );
}

function ExceptionReasonForm({
  note,
  subject,
  edit,
  register,
  disabled,
}: {
  note: ReviewException;
  subject: string;
  edit: Edit;
  register?: RegisterLocalForm;
  disabled: boolean;
}) {
  const f = useExceptionReasonForm({ note, subject, edit, register });
  const reason = f.form.watch('reason');
  return (
    <form
      noValidate
      id={f.elementId}
      aria-label={`${note.rule} exception`}
      onSubmit={f.submit}
      className="min-w-0 space-y-2"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <ReasonField
          label={`Reason for ${note.rule} exception`}
          registration={f.form.register('reason')}
          blank={reason.trim() === ''}
          error={f.form.formState.errors.reason}
          disabled={disabled}
          onEnter={() => {
            if (f.dirty && !f.saving) void f.submit();
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Clear ${note.rule} exception`}
          disabled={disabled}
          onClick={() => void f.clear()}
        >
          <X aria-hidden />
        </Button>
      </div>
      <FormNotes
        failure={f.failure}
        remoteChanged={f.remoteChanged}
        remoteMessage="Another player changed this reason. Your unsaved text is kept: Save replaces theirs, Cancel shows theirs."
      />
      {f.dirty && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={disabled || f.saving}
            aria-busy={f.saving || undefined}
          >
            <Check aria-hidden />
            {f.saving ? 'Saving…' : `Save ${note.rule} reason`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={f.cancel}
          >
            Cancel {note.rule} reason
          </Button>
        </div>
      )}
    </form>
  );
}
