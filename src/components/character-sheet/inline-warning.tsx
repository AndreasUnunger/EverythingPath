'use client';
import { TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import {
  MaintenanceReason,
  useMaintenanceReasonId,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

const message = 'min-w-0 [overflow-wrap:anywhere]';

function actionLabel({
  isSaving,
  isAccepted,
}: {
  isSaving: boolean;
  isAccepted: boolean;
}) {
  if (isSaving) return 'Saving…';
  return isAccepted ? 'Reopen' : 'Accept';
}

// A failed rules check, beside the field it is about (approved prototype,
// #208). Accepting records the table's choice and nothing else: the numbers
// stay as calculated, and an edit to the facts shows the warning again.
function RulesWarning({
  warning,
  controller,
}: {
  warning: SheetWarningView;
  controller: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const messageId = useId();
  const ownReasonId = useId();
  const reasonId = useMaintenanceReasonId(maintenance) ?? ownReasonId;
  const status = controller.statusFor(warning);
  const isSaving = status.kind === 'saving';
  const isDisabled = isSaving || maintenance.readOnly;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {warning.accepted ? (
        <span className="text-muted-foreground">
          Accepted
          <span id={messageId} className="sr-only">
            {' '}
            {warning.message}
          </span>
        </span>
      ) : (
        <span className="flex items-start gap-1.5 text-amber-300">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span id={messageId} className={message}>
            {warning.message}
          </span>
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 px-2 text-xs md:h-6"
        aria-describedby={
          maintenance.readOnly ? `${messageId} ${reasonId}` : messageId
        }
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return;
          if (warning.accepted) void controller.reopen(warning);
          else void controller.accept(warning);
        }}
      >
        {actionLabel({ isSaving, isAccepted: warning.accepted })}
      </Button>
      <SaveFeedback
        status={status}
        savedText={warning.accepted ? 'Warning accepted.' : 'Warning reopened.'}
      />
      <MaintenanceReason
        id={ownReasonId}
        notice={maintenance}
        className="text-xs"
      />
    </div>
  );
}

/**
 * One calculation warning where its subject is edited. The three kinds read
 * differently: a choice the sheet still needs is blue like the outline on
 * the empty field, a value the sheet cannot resolve yet is a muted
 * explanation, and a failed rules check is amber with Accept. Only the last
 * is a decision; the other two can never be accepted away.
 */
export function InlineWarning({
  warning,
  controller,
  className,
}: {
  warning: SheetWarningView;
  controller: Controller['warnings'];
  className?: string;
}) {
  if (warning.kind === 'rules')
    return (
      <div className={className}>
        <RulesWarning warning={warning} controller={controller} />
      </div>
    );
  return (
    <p
      className={cn(
        'text-xs',
        message,
        warning.kind === 'incomplete'
          ? 'text-sky-300'
          : 'text-muted-foreground',
        className,
      )}
    >
      {warning.message}
    </p>
  );
}

/** The warnings aimed at one place on the sheet, in calculation order. */
export function InlineWarnings({
  warnings,
  controller,
  className,
}: {
  warnings: SheetWarningView[];
  controller: Controller['warnings'];
  className?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {warnings.map((warning) => (
        <InlineWarning
          key={`${warning.check}:${warning.subject}`}
          warning={warning}
          controller={controller}
        />
      ))}
    </div>
  );
}
