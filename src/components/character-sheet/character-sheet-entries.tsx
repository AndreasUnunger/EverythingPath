'use client';
import type { Id } from '@convex/_generated/dataModel';
import { Check, Plus, SquarePen, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { isTemporaryEffect } from '~/lib/character-sheet';
import { cn } from '~/lib/utils';
import { SheetEntryEditor } from './sheet-entry-editor';
import { sheetEntryKindLabels } from './sheet-entry-classification-fields';
import { InlineWarnings } from './inline-warning';
import { describeModifier } from './modifier-labels';
import { listEntryModifierWarnings } from './modifier-warnings';
import { action, Block, chip, RemoteNotice, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import type { SheetEntryInput } from './use-character-sheet-entries';
import { useCreateThenEdit } from './use-create-then-edit';

type Controller = ReturnType<typeof useCharacterSheet>;
type Row = NonNullable<Controller['sheet']>['sheetEntries'][number];
type EntryId = Id<'characterSheetEntry'>;
type OpenEditor = { kind: 'new' } | { kind: 'entry'; entryId: EntryId } | null;
type WarningProps = {
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
};

/** "Spell Effect · CL 7", "Consumable item": the row's classification. */
function describeClassification(row: Row) {
  const { detail, state } = row;
  if (detail.kind === 'spellEffect' && state.kind === 'spellEffect')
    return `${sheetEntryKindLabels.spellEffect} · CL ${state.casterLevel}`;
  if (detail.kind === 'item' && detail.consumable) return 'Consumable item';
  return sheetEntryKindLabels[detail.kind];
}

// The resolver's own classification, so the chip never disagrees with it.
function isTemporaryRow({ detail }: Row) {
  return isTemporaryEffect({ kind: detail.kind }, detail);
}

function describeModifiers(row: Row) {
  if (row.detail.kind === 'spell') return 'Grants no Modifiers.';
  if (row.modifiers.length === 0) return 'No Modifiers.';
  return row.modifiers.map(describeModifier).join(' · ');
}

function toInput(row: Row): SheetEntryInput {
  return {
    name: row.name,
    modifiers: row.modifiers,
    detail: row.detail,
    ...(row.state.kind === 'spellEffect'
      ? { casterLevel: row.state.casterLevel }
      : {}),
  };
}

// A row's formula warnings sit under it while its editor is closed; once
// open, the editor shows each one under the Modifier it is about.
function SheetEntryRow({
  row,
  isBusy,
  isOpen,
  actions,
  warnings,
  warningController,
  onEdit,
}: WarningProps & {
  row: Row;
  isBusy: boolean;
  isOpen: boolean;
  actions: Controller['sheetEntries'];
  onEdit: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const nameId = useId();
  const isDisabled = isBusy || maintenance.readOnly;
  const isTemporary = isTemporaryRow(row);
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
            {describeClassification(row)}
          </span>
          {isTemporary ? (
            <span className={cn(chip, 'text-muted-foreground')}>Temporary</span>
          ) : null}
          {row.active ? null : (
            <span className={cn(chip, 'text-muted-foreground')}>Inactive</span>
          )}
        </div>
        <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">
          {describeModifiers(row)}
        </p>
        {isOpen ? null : (
          <InlineWarnings
            warnings={warnings}
            controller={warningController}
            className="mt-1"
          />
        )}
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

function NewSheetEntryEditor({
  actions,
  onClose,
}: {
  actions: Controller['sheetEntries'];
  onClose: () => void;
}) {
  const creation = useCreateThenEdit({
    create: actions.create,
    edit: actions.edit,
  });
  return <SheetEntryEditor save={creation.save} onClose={onClose} isNew />;
}

// The editor lives below the list so another player's removal cannot take a
// draft with it. A removed entry's draft saves as a new entry and then
// follows that one.
function EntryEditor({
  entryId,
  rows,
  actions,
  warnings,
  warningController,
  onClose,
}: WarningProps & {
  entryId: EntryId;
  rows: Row[];
  actions: Controller['sheetEntries'];
  onClose: () => void;
}) {
  const creation = useCreateThenEdit({
    create: actions.create,
    edit: actions.edit,
  });
  const row = rows.find(
    (item) => item.entryId === (creation.createdId ?? entryId),
  );
  return (
    <SheetEntryEditor
      value={row ? toInput(row) : undefined}
      save={row ? (input) => actions.edit(row.entryId, input) : creation.save}
      onClose={onClose}
      isNew={false}
      isRemoved={!row}
      warnings={row ? listEntryModifierWarnings(warnings, row.entryId) : []}
      warningController={warningController}
    />
  );
}

/**
 * Spell Effects, conditions, items and recorded Spells on the Character:
 * each with its name, classification, active state and Modifiers, toggled,
 * edited and removed in place. One editor is open at a time, keyed by its
 * entry so switching rows never carries a draft over.
 */
export function CharacterSheetEntries({
  rows,
  actions,
  warnings,
  warningController,
}: WarningProps & {
  rows: Row[];
  actions: Controller['sheetEntries'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const [open, setOpen] = useState<OpenEditor>(null);
  const isBusy = actions.status.kind === 'saving';
  const close = () => setOpen(null);
  const openEntryId = open?.kind === 'entry' ? open.entryId : null;
  return (
    <Block
      title="Sheet entries"
      aside={
        <p className="text-muted-foreground font-mono text-xs">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </p>
      }
    >
      <div className="space-y-2">
        <RemoteNotice
          isShown={actions.hasRemoteChange}
          message="Sheet entries changed."
          subject="entries"
          onDismiss={actions.dismissRemoteChange}
        />
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No entries.</p>
        ) : (
          <ul className="divide-foreground/10 divide-y">
            {rows.map((row) => (
              <li key={row.entryId} aria-label={row.name}>
                <SheetEntryRow
                  row={row}
                  isBusy={isBusy}
                  isOpen={openEntryId === row.entryId}
                  actions={actions}
                  warnings={listEntryModifierWarnings(warnings, row.entryId)}
                  warningController={warningController}
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
            warnings={warnings}
            warningController={warningController}
            onClose={close}
          />
        ) : null}
        {open?.kind === 'new' ? (
          <NewSheetEntryEditor
            key="new-entry"
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
            Add entry
          </Button>
          <SaveFeedback
            status={actions.status}
            savedText="Sheet entries saved."
          />
          <MaintenanceReason notice={maintenance} />
        </div>
      </div>
    </Block>
  );
}
