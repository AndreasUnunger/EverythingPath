'use client';
import type { Id } from '@convex/_generated/dataModel';
import { Check, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { describeModifier } from './modifier-labels';
import { PersonalAdjustmentEditor } from './personal-adjustment-editor';
import { action, Block, chip, RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  PersonalAdjustmentInput,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Row = NonNullable<Controller['sheet']>['adjustments'][number];
type EntryId = Id<'characterSheetEntry'>;
type OpenEditor = { kind: 'new' } | { kind: 'entry'; entryId: EntryId } | null;

const newEditorKey = 'new-adjustment';

function AdjustmentRow({
  row,
  isBusy,
  isOpen,
  actions,
  onEdit,
}: {
  row: Row;
  isBusy: boolean;
  isOpen: boolean;
  actions: Controller['adjustments'];
  onEdit: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const nameId = useId();
  const isDisabled = isBusy || maintenance.readOnly;
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
      <button
        type="button"
        role="switch"
        aria-checked={row.active}
        aria-label={`${row.name}: ${row.active ? 'active' : 'inactive'}`}
        disabled={isDisabled}
        onClick={() => void actions.setActive(row.entryId, !row.active)}
        className={cn(
          'mt-0.5 inline-flex size-11 shrink-0 items-center justify-center border md:size-7',
          row.active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-foreground/40 hover:border-foreground text-transparent',
          'disabled:opacity-50',
        )}
      >
        <Check aria-hidden className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3
            id={nameId}
            className={cn(
              'font-sans text-base [overflow-wrap:anywhere]',
              row.active ? '' : 'text-muted-foreground',
            )}
          >
            {row.name}
          </h3>
          <span className={cn(chip, row.active ? '' : 'text-muted-foreground')}>
            {row.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
          {row.modifiers.map(describeModifier).join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant={isOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="size-11 md:size-8"
          aria-pressed={isOpen}
          onClick={onEdit}
        >
          <SquarePen aria-hidden className="size-4" />
          <span className="sr-only">Edit {row.name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 md:size-8"
          disabled={isDisabled}
          onClick={() => void actions.remove(row.entryId)}
        >
          <Trash2 aria-hidden className="size-4" />
          <span className="sr-only">Remove {row.name}</span>
        </Button>
      </div>
    </div>
  );
}

// A creating save: the first one creates, and once the entry exists any
// save of input typed meanwhile edits that same entry instead of creating a
// twin. The ref answers the save in flight; the state lets the editor find
// its new row.
function useCreateThenEdit(actions: Controller['adjustments']) {
  const created = useRef<EntryId | null>(null);
  const [createdId, setCreatedId] = useState<EntryId | null>(null);
  const save = async (input: PersonalAdjustmentInput) => {
    if (created.current) return actions.edit(created.current, input);
    created.current = await actions.create(input);
    setCreatedId(created.current);
  };
  return { save, createdId };
}

function NewAdjustmentEditor({
  actions,
  onClose,
}: {
  actions: Controller['adjustments'];
  onClose: () => void;
}) {
  const creation = useCreateThenEdit(actions);
  return (
    <PersonalAdjustmentEditor save={creation.save} onClose={onClose} isNew />
  );
}

// The open entry's editor lives below the list, not in its row, so another
// player removing the row cannot take an unsaved draft with it. A removed
// entry's draft saves as a new adjustment and then follows that one.
function EntryEditor({
  entryId,
  rows,
  actions,
  onClose,
}: {
  entryId: EntryId;
  rows: Row[];
  actions: Controller['adjustments'];
  onClose: () => void;
}) {
  const creation = useCreateThenEdit(actions);
  const row = rows.find(
    (item) => item.entryId === (creation.createdId ?? entryId),
  );
  return (
    <PersonalAdjustmentEditor
      adjustment={
        row ? { name: row.name, modifiers: row.modifiers } : undefined
      }
      save={row ? (input) => actions.edit(row.entryId, input) : creation.save}
      onClose={onClose}
      isNew={false}
      isRemoved={!row}
    />
  );
}

/**
 * The player's own additions to the sheet: each with its name, active state
 * and Modifiers, toggled, edited and removed in place. One editor is open at
 * a time, keyed by its entry so switching rows never carries a draft over.
 */
export function PersonalAdjustments({
  rows,
  actions,
}: {
  rows: Row[];
  actions: Controller['adjustments'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [open, setOpen] = useState<OpenEditor>(null);
  const isBusy = actions.status.kind === 'saving';
  const close = () => setOpen(null);
  const openEntryId = open?.kind === 'entry' ? open.entryId : null;
  return (
    <Block
      title="Personal adjustments"
      aside={
        <p className="text-muted-foreground font-mono text-xs">
          {rows.length} {rows.length === 1 ? 'adjustment' : 'adjustments'}
        </p>
      }
    >
      <div className="space-y-2">
        <RemoteNotice
          isShown={actions.hasRemoteChange}
          message="Personal adjustments changed."
          subject="personal adjustments"
          onDismiss={actions.dismissRemoteChange}
        />
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No personal adjustments.
          </p>
        ) : (
          <ul className="divide-foreground/10 divide-y">
            {rows.map((row) => (
              <li key={row.entryId} aria-label={row.name}>
                <AdjustmentRow
                  row={row}
                  isBusy={isBusy}
                  isOpen={openEntryId === row.entryId}
                  actions={actions}
                  onEdit={() =>
                    setOpen(
                      openEntryId === row.entryId
                        ? null
                        : { kind: 'entry', entryId: row.entryId },
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {openEntryId !== null ? (
          <EntryEditor
            key={openEntryId}
            entryId={openEntryId}
            rows={rows}
            actions={actions}
            onClose={close}
          />
        ) : null}
        {open?.kind === 'new' ? (
          <NewAdjustmentEditor
            key={newEditorKey}
            actions={actions}
            onClose={close}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={action}
            disabled={maintenance.readOnly || open?.kind === 'new'}
            onClick={() => setOpen({ kind: 'new' })}
          >
            <Plus aria-hidden className="size-4" />
            Add personal adjustment
          </Button>
          <SaveFeedback
            status={actions.status}
            savedText="Personal adjustments saved."
          />
          <MaintenanceReason notice={maintenance} />
        </div>
      </div>
    </Block>
  );
}
