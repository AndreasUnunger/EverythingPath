'use client';
import { useId, useRef, type ReactNode } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';

const answerButton = 'h-11 md:h-8';

/**
 * A deletion asked in place (approved prototype) where a trash control
 * stood: the question, Delete and Keep, then maintenance and anything the
 * caller reports beside them. Focus lands on Keep, the harmless answer, and
 * returns there when Delete is sent, so it never rests on a disabled button.
 * Escape answers Keep. The caller owns the write and what follows it.
 */
export function InlineDeleteQuestion({
  question,
  subject,
  isBusy,
  isKeepDisabled = false,
  className,
  onDelete,
  onKeep,
  children,
}: {
  question: string;
  /** Read out after each answer, so "Delete" and "Keep" name their target. */
  subject: string;
  /** Another write is pending: Delete waits for it. */
  isBusy: boolean;
  isKeepDisabled?: boolean;
  className?: string;
  onDelete: () => void;
  onKeep: () => void;
  children?: ReactNode;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const questionId = useId();
  const keep = useRef<HTMLButtonElement>(null);
  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className={cn(
        'flex flex-wrap items-center gap-x-1 gap-y-1 text-xs',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onKeep();
      }}
    >
      <p id={questionId} className="px-1">
        {question}
      </p>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={answerButton}
        disabled={isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          keep.current?.focus();
          onDelete();
        }}
      >
        Delete <span className="sr-only">{subject}</span>
      </Button>
      <Button
        ref={keep}
        type="button"
        size="sm"
        variant="ghost"
        className={answerButton}
        autoFocus
        disabled={isKeepDisabled}
        onClick={onKeep}
      >
        Keep <span className="sr-only">{subject}</span>
      </Button>
      <MaintenanceReason notice={maintenance} />
      {children}
    </div>
  );
}
