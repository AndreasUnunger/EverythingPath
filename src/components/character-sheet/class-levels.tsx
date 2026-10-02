'use client';
import { useEffect, useRef } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import {
  ClassLevelRow,
  getLevelAnchorId,
  levelColumns,
} from './class-level-row';
import { InlineWarnings } from './inline-warning';
import {
  action,
  Block,
  chip,
  fieldLabel,
  RemoteNotice,
  SaveFeedback,
  getScrollBehavior,
} from './sheet-parts';
import type {
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';

type Controller = ReturnType<typeof useCharacterSheet>;
type ReadySheet = NonNullable<Controller['sheet']>;

function findRowInput(entryId: string) {
  return document
    .getElementById(getLevelAnchorId(entryId))
    ?.querySelector<HTMLInputElement>('input');
}

function findRowDeleteButton(entryId: string) {
  return document
    .getElementById(getLevelAnchorId(entryId))
    ?.querySelector<HTMLElement>('[data-delete-level]');
}

/**
 * The ordered Class Levels: every row keyed by its stable entry, Level up
 * appending an Unspecified level, and the section's own save and
 * another-player feedback. Every level may be removed; at zero the PC rule
 * warns, acceptably, and Level 1 can be appended again. Total HP is the sum
 * of these rows, so while it cannot resolve the reason reads here, under
 * them, rather than growing the pinned summary.
 */
export function ClassLevels({
  rows,
  warnings,
  warningController,
  levels,
  saveHitPoints,
}: {
  rows: ReadySheet['levels'];
  warnings: SheetWarningView[];
  warningController: Controller['warnings'];
  levels: Controller['levels'];
  saveHitPoints: Controller['saveHitPoints'];
}) {
  const maintenance = useInitialMigrationMaintenance();
  const isBusy = levels.status.kind === 'saving';
  const levelUp = useRef<HTMLButtonElement>(null);
  // The row a player is deleting, so focus can land on its successor (or
  // the last row, or Level up) once the subscription drops it.
  const deleting = useRef<{ entryId: string; index: number } | null>(null);

  useEffect(() => {
    const pending = deleting.current;
    if (!pending || levels.status.kind === 'saving') return;
    if (levels.status.kind === 'error') {
      deleting.current = null;
      return;
    }
    // Saved, but the subscription may not have dropped the row yet.
    if (rows.some((row) => row._id === pending.entryId)) return;
    deleting.current = null;
    const successor = rows[Math.min(pending.index, rows.length - 1)];
    const target = successor
      ? findRowDeleteButton(successor._id)
      : levelUp.current;
    target?.focus();
  }, [rows, levels.status.kind]);

  // Only the device that appended scrolls to and focuses the new level.
  const appended = levels.appendedEntryId;
  useEffect(() => {
    if (!appended || !rows.some((row) => row._id === appended)) return;
    const input = findRowInput(appended);
    input?.scrollIntoView({ block: 'center', behavior: getScrollBehavior() });
    input?.focus({ preventScroll: true });
    levels.acknowledgeAppend();
  }, [appended, rows, levels]);

  return (
    <Block
      title="Class Levels"
      aside={
        <p className="text-muted-foreground font-mono text-xs">
          {rows.length} {rows.length === 1 ? 'level' : 'levels'}
        </p>
      }
    >
      <div className="space-y-2">
        <RemoteNotice
          isShown={levels.hasRemoteChange}
          message="Class Levels updated by another player."
          subject="Class Levels"
          onDismiss={levels.dismissRemoteChange}
        />
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No Class Levels yet.</p>
        ) : (
          <>
            <div
              aria-hidden
              className={cn('hidden px-2 md:grid', levelColumns, fieldLabel)}
            >
              <span>Level</span>
              <span>Class</span>
              <span>Hit points</span>
              <span />
            </div>
            <ul className="space-y-2">
              {rows.map((row, index) => (
                <ClassLevelRow
                  key={row._id}
                  row={row}
                  index={index}
                  count={rows.length}
                  warnings={warnings.filter(
                    (warning) =>
                      warning.target.kind === 'classLevel' &&
                      warning.target.entryId === row._id,
                  )}
                  warningController={warningController}
                  saveHitPoints={saveHitPoints}
                  isChangingLevels={isBusy}
                  moveLevel={levels.move}
                  onDelete={() => {
                    if (maintenance.readOnly) return;
                    deleting.current = { entryId: row._id, index };
                    void levels.remove(row._id);
                  }}
                />
              ))}
            </ul>
          </>
        )}
        <InlineWarnings
          warnings={warnings.filter(
            (warning) =>
              warning.target.kind === 'classLevels' ||
              warning.target.kind === 'hitPoints',
          )}
          controller={warningController}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm">
          <span className="text-muted-foreground">
            Level {rows.length + 1} as
          </span>
          <span className={chip}>Unspecified</span>
          <Button
            ref={levelUp}
            type="button"
            size="sm"
            variant="outline"
            className={action}
            disabled={isBusy || maintenance.readOnly}
            onClick={() => {
              if (maintenance.readOnly) return;
              void levels.add();
            }}
          >
            Level up
          </Button>
          <SaveFeedback
            status={levels.status}
            savedText="Class Levels saved."
          />
          <MaintenanceReason notice={maintenance} />
        </div>
      </div>
    </Block>
  );
}
