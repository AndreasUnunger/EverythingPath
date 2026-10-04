'use client';
import { SquarePen, X } from 'lucide-react';
import { useId } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { AttackLine } from './attack-line';
import {
  handsLabels,
  listAttackRoutineWarnings,
  modeLabels,
} from './attack-routine-view-model';
import { InlineWarnings } from './inline-warning';
import { action, fieldLabel, SaveFeedback } from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type Attacks = Controller['attacks'];
type Row = Attacks['rows'][number];

const iconButton = 'size-11 shrink-0 md:size-8';

function AttackList({
  title,
  lines,
  row,
  sequence,
}: {
  title: string;
  lines: Row['singleView'];
  row: Row;
  sequence: 'single' | 'full';
}) {
  const id = useId();
  const hasOffHand = lines.some((line) => line.hand === 'off');
  return (
    <div>
      <p id={id} className={fieldLabel}>
        {title}
      </p>
      <ol aria-labelledby={id} className="divide-foreground/10 divide-y">
        {lines.map((line) => (
          <AttackLine
            key={line.position ?? 0}
            line={line}
            routineName={row.name}
            sequence={sequence}
            count={lines.length}
            isHandShown={hasOffHand}
          />
        ))}
      </ol>
    </div>
  );
}

/**
 * One saved Attack Routine (approved prototype's routine card): its name,
 * weapon and how it is held, its off hand, Edit and Remove, its warnings,
 * then its single attack and its full attack in order, the off hand's
 * attacks after the main hand's. A routine whose weapon is gone keeps
 * its card with the warning and a way to choose another weapon, and shows
 * no attacks.
 */
export function AttackRoutineRow({
  row,
  attacks,
  warnings,
  warningController,
  onEdit,
  onRemoved,
}: {
  row: Row;
  attacks: Attacks;
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  onEdit: () => void;
  /** After an acknowledged removal, when this card's controls are gone. */
  onRemoved?: () => void;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const status = attacks.statusFor(row.entryId);
  const isRemoving = status.kind === 'saving';
  const weapon = attacks.weapons.find(
    (candidate) => candidate.entryId === row.weaponEntryId,
  );
  const hasAttacks = row.singleView.length > 0;
  const offHandReference = row.offHand;
  const offHand = offHandReference
    ? offHandReference.kind === 'otherEnd'
      ? 'Other end'
      : (attacks.weapons.find(
          (candidate) => candidate.entryId === offHandReference.weaponEntryId,
        )?.label ?? 'No weapon')
    : null;
  const facts = [
    weapon?.label ?? 'No weapon',
    handsLabels[row.hands],
    modeLabels[row.mode],
    ...(offHand ? [`Off hand: ${offHand}`] : []),
  ].join(' · ');

  async function remove() {
    if (await attacks.remove(row.entryId)) onRemoved?.();
  }

  return (
    <div className="border-foreground/15 border px-2 py-1">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 py-1">
          <h3 className="font-sans text-base leading-tight [overflow-wrap:anywhere]">
            {row.name}
          </h3>
          <p className="text-muted-foreground font-mono text-xs [overflow-wrap:anywhere]">
            {facts}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconButton}
          data-routine-edit={row.entryId}
          onClick={onEdit}
        >
          <SquarePen aria-hidden className="size-4" />
          <span className="sr-only">Edit {row.name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`${iconButton} hover:text-destructive`}
          aria-describedby={reasonId}
          disabled={isRemoving || maintenance.readOnly}
          onClick={() => void remove()}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Remove {row.name}</span>
        </Button>
      </div>
      <InlineWarnings
        warnings={listAttackRoutineWarnings(warnings, row)}
        controller={warningController}
        className="pb-1"
      />
      {hasAttacks ? (
        <div className="space-y-1 pb-1">
          <AttackList
            title="Single attack"
            lines={row.singleView}
            row={row}
            sequence="single"
          />
          <AttackList
            title="Full attack"
            lines={row.fullView}
            row={row}
            sequence="full"
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`${action} mb-1`}
          onClick={onEdit}
        >
          Choose a weapon <span className="sr-only">for {row.name}</span>
        </Button>
      )}
      <SaveFeedback
        status={status}
        savedText="Removed."
        savingText="Removing…"
        shouldHideWhenIdle
      />
    </div>
  );
}
