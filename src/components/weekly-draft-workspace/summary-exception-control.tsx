'use client';
import { z } from 'zod';
import { Button } from '~/components/ui/button';
import type { ReviewException } from '~/components/week-review/review-facts';
import { StructuredChoiceField } from './structured-choice-field';
import type { WeeklyDraftWorkspace } from './types';

/** The live Summary's controls under a Rules Exception: reason editor or removal. */
export function ExceptionControl({
  note,
  edit,
  disabled,
}: {
  note: ReviewException;
  edit: Extract<WeeklyDraftWorkspace, { status: 'ready' }>['edit'];
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
    <StructuredChoiceField
      name="exceptionReason"
      schema={z.string().trim().min(1, 'A reason is required.')}
      value={note.reason || undefined}
      options={{}}
      disabled={disabled}
      onValue={(reason) => {
        if (reason === undefined) {
          void edit({
            kind: 'clear_rules_exception',
            exceptionId: note.exceptionId,
          });
          return false;
        }
        if (typeof reason === 'string')
          void edit({
            kind: 'rules_exception',
            exception: {
              exceptionId: note.exceptionId,
              subjectId: note.subjectId,
              ruleId: note.ruleId,
              reason,
            },
          });
      }}
    />
  );
}
