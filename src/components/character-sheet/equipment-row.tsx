'use client';
import { SquarePen } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { EquipmentEditor } from './equipment-editor';
import {
  describeArmorCategory,
  describeNonproficiency,
  listEquipmentFacts,
} from './equipment-statistics';
import { InlineWarnings } from './inline-warning';
import { action, chip, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Equipment = Controller['equipment'];
type Row = Equipment['rows'][number];

const mutedChip = cn(chip, 'text-muted-foreground');

/**
 * One armor or shield (approved variant B's gear rows): its name and
 * category, Equip or Unequip, and Edit for its gear state. While it counts,
 * its figures are the resolver's, with a penalty for wearing it without
 * the Proficiency stated as a number. Off and dormant items stay listed with
 * their recorded figures. The row's own save reads beside it; other rows
 * stay usable.
 */
export function EquipmentRow({
  row,
  equipment,
  warnings,
  warningController,
}: {
  row: Row;
  equipment: Equipment;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const [isEditing, setIsEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const status = equipment.statusFor(row.entryId);
  const isSaving = status.kind === 'saving';
  const isMuted = !row.active || !row.counting;
  const nonproficiency = describeNonproficiency(row.calculated);

  function closeEditor() {
    setIsEditing(false);
    editButton.current?.focus();
  }

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3
              className={cn(
                'font-sans text-base [overflow-wrap:anywhere]',
                isMuted && 'text-muted-foreground',
              )}
            >
              {row.name}
            </h3>
            <span className={cn(chip, isMuted && 'text-muted-foreground')}>
              {describeArmorCategory({
                slot: row.armor.slot,
                category: row.armor.category,
              })}
            </span>
            {row.active ? null : (
              <span className={mutedChip}>Not equipped</span>
            )}
            {row.dormant && !row.counting ? (
              <span className={mutedChip}>Not counting now</span>
            ) : null}
          </div>
          <p className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]">
            {listEquipmentFacts(row).join(' · ')}
          </p>
          {row.dormant && !row.counting ? (
            <p className="text-muted-foreground text-xs">
              Its source no longer counts, so its figures stay out of the sheet
              until it does.
            </p>
          ) : null}
          {nonproficiency ? <p className="text-xs">{nonproficiency}</p> : null}
          <InlineWarnings
            warnings={warnings}
            controller={warningController}
            className="mt-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(action, 'min-w-24')}
            aria-describedby={reasonId}
            disabled={isSaving || maintenance.readOnly}
            onClick={() =>
              void equipment.saveActiveWithStatus(row.entryId, !row.active)
            }
          >
            {row.active ? 'Unequip' : 'Equip'}{' '}
            <span className="sr-only">{row.name}</span>
          </Button>
          <Button
            ref={editButton}
            type="button"
            variant={isEditing ? 'secondary' : 'ghost'}
            size="icon"
            className="size-11 md:size-8"
            aria-pressed={isEditing}
            onClick={() => setIsEditing(!isEditing)}
          >
            <SquarePen aria-hidden className="size-4" />
            <span className="sr-only">Edit {row.name}</span>
          </Button>
        </div>
        <SaveFeedback
          status={status}
          savedText="Saved"
          savingText="Saving…"
          shouldHideWhenIdle
        />
      </div>
      {isEditing ? (
        <EquipmentEditor
          row={row}
          save={(values) => equipment.save(row.entryId, values)}
          onClose={closeEditor}
        />
      ) : null}
    </div>
  );
}
