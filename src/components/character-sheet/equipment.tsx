'use client';
import { useId } from 'react';
import {
  MaintenanceReason,
  MaintenanceReasonScope,
} from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { EquipmentRow } from './equipment-row';
import { listEquipmentWarnings } from './equipment-statistics';
import { EquipmentSummary } from './equipment-summary';
import { Block, RemoteNotice } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;

/**
 * Equipment (approved variant B, beside Defenses): every armor and shield on
 * the Character, equipped or not, with what the equipped ones add up to.
 * AC and its variants stay in Defenses, which already include them; the
 * skill totals already include the armor check penalty. Items are added and
 * removed as Sheet entries; their gear state is edited here.
 */
export function Equipment({
  equipment,
  warnings,
  warningController,
}: {
  equipment: Controller['equipment'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useId();
  return (
    <Block title="Equipment">
      <MaintenanceReasonScope id={reasonId}>
        <div className="space-y-2">
          <RemoteNotice
            isShown={equipment.hasRemoteChange}
            message="Changed by another player."
            subject="equipment"
            onDismiss={equipment.dismissRemoteChange}
          />
          {equipment.totals ? (
            <EquipmentSummary totals={equipment.totals} />
          ) : null}
          {equipment.rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No armor or shields.
            </p>
          ) : (
            <ul className="divide-foreground/10 divide-y">
              {equipment.rows.map((row) => (
                <li key={row.entryId} aria-label={row.name}>
                  <EquipmentRow
                    row={row}
                    equipment={equipment}
                    warnings={listEquipmentWarnings(warnings, row.entryId)}
                    warningController={warningController}
                  />
                </li>
              ))}
            </ul>
          )}
          <MaintenanceReason
            id={reasonId}
            notice={maintenance}
            className="text-xs"
          />
        </div>
      </MaintenanceReasonScope>
    </Block>
  );
}
