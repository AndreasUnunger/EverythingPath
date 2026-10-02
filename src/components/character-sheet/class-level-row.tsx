'use client';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '~/components/ui/form';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { InlineDeleteQuestion } from './inline-delete-question';
import { InlineWarnings } from './inline-warning';
import {
  chip,
  fieldLabel,
  missingChoice,
  RemoteNotice,
  SaveFeedback,
} from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { useClassLevelForm } from './use-sheet-forms';

type Controller = ReturnType<typeof useCharacterSheet>;
type LevelRow = NonNullable<Controller['sheet']>['levels'][number];

function listFieldWarnings(
  warnings: SheetWarningView[],
  field: 'class' | 'hpGained',
) {
  return warnings.filter(
    (warning) =>
      warning.target.kind === 'classLevel' && warning.target.field === field,
  );
}

/** The row's DOM anchor: found again after an append or a deletion. */
export function getLevelAnchorId(entryId: string) {
  return `sheet-level-${entryId}`;
}

/** Level · Class · Hit points · actions, from tablet width. */
export const levelColumns =
  'md:grid-cols-[5.5rem_7.5rem_minmax(0,1fr)_auto] md:gap-x-3';

const actionsCell =
  'col-start-2 row-start-1 flex items-center justify-end md:col-start-4';
const rowButton = 'size-11 md:size-8';

// A level's own actions; moves are disabled only at the ends of the list
// and while another structural change is pending.
function LevelActions({
  level,
  headingId,
  isFirst,
  isLast,
  isBusy,
  onMove,
  onDelete,
}: {
  level: number;
  headingId: string;
  isFirst: boolean;
  isLast: boolean;
  isBusy: boolean;
  onMove: (position: number) => void;
  onDelete: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  if (isConfirmingDelete)
    return (
      <InlineDeleteQuestion
        question={`Delete Unspecified (level ${level})?`}
        subject={`level ${level}`}
        isBusy={isBusy}
        className={actionsCell}
        onDelete={onDelete}
        onKeep={() => {
          flushSync(() => setIsConfirmingDelete(false));
          const trigger = deleteTrigger.current;
          if (trigger && !trigger.disabled) trigger.focus();
          else document.getElementById(headingId)?.focus();
        }}
      />
    );
  return (
    <div className={actionsCell}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={rowButton}
        aria-label={`Move level ${level} up`}
        disabled={isFirst || isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          onMove(level - 1);
        }}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={rowButton}
        aria-label={`Move level ${level} down`}
        disabled={isLast || isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          onMove(level + 1);
        }}
      >
        <ArrowDown />
      </Button>
      <Button
        ref={deleteTrigger}
        type="button"
        size="icon"
        variant="ghost"
        data-delete-level
        className={cn(
          rowButton,
          'text-muted-foreground hover:text-destructive',
        )}
        aria-label={`Delete level ${level}`}
        disabled={isBusy || maintenance.readOnly}
        onClick={() => {
          if (maintenance.readOnly) return;
          setIsConfirmingDelete(true);
        }}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/**
 * One Class Level, mounted once per stable entry and kept through reorders
 * so its typed hit points, focus and field error travel with it. Its label
 * is its current position. The row's own warnings sit by the field they
 * are about: the class still to choose, the hit points still to enter or
 * below the rule.
 */
export function ClassLevelRow({
  row,
  index,
  count,
  warnings,
  warningController,
  saveHitPoints,
  isChangingLevels,
  moveLevel,
  onDelete,
}: {
  row: LevelRow;
  index: number;
  count: number;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  saveHitPoints: Controller['saveHitPoints'];
  isChangingLevels: boolean;
  moveLevel: Controller['levels']['move'];
  onDelete: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const level = index + 1;
  const headingId = useId();
  const editor = useClassLevelForm({
    hpGained: row.state.hpGained,
    save: (hpGained) => saveHitPoints(row._id, hpGained),
  });
  const isSaving = editor.status.kind === 'saving';
  return (
    <li
      id={getLevelAnchorId(row._id)}
      aria-labelledby={headingId}
      className={cn(
        'border-foreground/20 grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 border p-2 md:items-start',
        levelColumns,
      )}
    >
      <h3
        id={headingId}
        tabIndex={-1}
        className="col-start-1 row-start-1 self-center font-mono text-base md:py-1.5"
      >
        Level {level}
      </h3>
      <div className="col-span-2 flex flex-col gap-1 md:col-span-1 md:col-start-2 md:row-start-1 md:py-1.5">
        <p className="flex items-center gap-2">
          <span className={cn(fieldLabel, 'md:sr-only')}>Class</span>
          <span className={cn(chip, missingChoice)}>Unspecified</span>
        </p>
        <InlineWarnings
          warnings={listFieldWarnings(warnings, 'class')}
          controller={warningController}
        />
      </div>
      <Form {...editor.form}>
        <form
          noValidate
          aria-label={`Level ${level} hit points`}
          className="col-span-2 flex flex-wrap items-start gap-x-3 gap-y-1 md:col-span-1 md:col-start-3 md:row-start-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (maintenance.readOnly) return;
            void editor.save();
          }}
        >
          <FormField
            control={editor.form.control}
            name="hpGained"
            render={({ field, fieldState }) => (
              <FormItem className="gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FormLabel className="font-mono text-sm font-normal">
                    Hit points{' '}
                    <span className="sr-only">gained at level {level}</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={maintenance.readOnly}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="h-10 w-20 text-center font-mono md:h-8"
                    />
                  </FormControl>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="min-h-10 md:min-h-8"
                    disabled={isSaving || maintenance.readOnly}
                  >
                    {isSaving ? 'Saving…' : 'Save hit points'}
                  </Button>
                </div>
                <FormMessage
                  role={fieldState.error ? 'alert' : undefined}
                  className="max-w-sm"
                />
              </FormItem>
            )}
          />
          <SaveFeedback status={editor.status} savedText="Hit points saved." />
          <MaintenanceReason notice={maintenance} />
          <RemoteNotice
            isShown={editor.hasRemoteChange}
            message={
              editor.form.formState.isDirty
                ? 'Updated by another player. Your edits are kept.'
                : 'Updated by another player.'
            }
            subject={`level ${level} hit points`}
            onDismiss={editor.dismissRemoteChange}
          />
          <InlineWarnings
            warnings={listFieldWarnings(warnings, 'hpGained')}
            controller={warningController}
            className="w-full"
          />
        </form>
      </Form>
      <LevelActions
        level={level}
        headingId={headingId}
        isFirst={index === 0}
        isLast={index === count - 1}
        isBusy={isChangingLevels}
        onMove={(position) => void moveLevel(row._id, position)}
        onDelete={onDelete}
      />
    </li>
  );
}
