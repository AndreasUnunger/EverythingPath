'use client';
import type { Id } from '@convex/_generated/dataModel';
import { useId, useState } from 'react';
import { useMaintenanceReasonId } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import type { SaveStatus } from './save-status';
import { SaveFeedback } from './sheet-parts';
import type { useCharacterSheet } from './use-character-sheet';

type Classes = ReturnType<typeof useCharacterSheet>['classes'];
type Version = ReturnType<Classes['versionChoicesFor']>[number];

const idle: SaveStatus = { kind: 'idle' };

// "Original", or "Original: Rogue (campaign)" where two versions share a label.
function versionText(version: Version, versions: Version[]) {
  const isShared =
    versions.filter((other) => other.kind === version.kind).length > 1;
  return isShared ? `${version.label}: ${version.name}` : version.label;
}

/**
 * Original or Unchained for every Class Level of the class, switched in one
 * write and never by editing each level. While the class is switching every
 * level's control waits; the one that asked reports Saving…, the saved
 * version or the refusal with Retry, and keeps its focus. The displayed
 * version is the saved one until the switch is saved.
 */
export function ClassVersionControl({
  entryId,
  className,
  classes,
  disabled,
}: {
  entryId: Id<'characterSheetEntry'>;
  /** The class's name, for "Version of Rogue" and "Change all Rogue levels". */
  className: string;
  classes: Classes;
  /** Maintenance, or a change to the Class Levels in flight. */
  disabled: boolean;
}) {
  const maintenance = useInitialMigrationMaintenance();
  const reasonId = useMaintenanceReasonId(maintenance);
  const labelId = useId();
  const descriptionId = useId();
  // The version this control last asked for: its feedback and its Retry.
  const [attempt, setAttempt] = useState<Id<'catalogEntry'> | null>(null);
  const versions = classes.versionChoicesFor(entryId);
  if (versions.length === 0) return null;
  const status = classes.statusFor(entryId);
  const isSaving = status.kind === 'saving';
  const isDisabled = disabled || maintenance.readOnly;
  const describedBy = [descriptionId, reasonId].filter(Boolean).join(' ');

  function switchTo(classEntryId: Id<'catalogEntry'>) {
    if (isDisabled || isSaving) return;
    setAttempt(classEntryId);
    void classes.switchVersion(entryId, classEntryId);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex min-w-0 flex-wrap"
      >
        <span id={labelId} className="sr-only">
          Version of {className}
        </span>
        {versions.map((version) => (
          <Button
            key={version.classEntryId}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={version.selected}
            aria-describedby={describedBy}
            // Saving keeps focus here: aria-disabled, not disabled.
            aria-disabled={isSaving || undefined}
            disabled={isDisabled}
            className={cn(
              'h-auto min-h-10 min-w-0 flex-1 rounded-none px-2 text-xs font-normal whitespace-normal md:min-h-7',
              'aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary',
              'aria-disabled:cursor-wait aria-disabled:opacity-60',
            )}
            onClick={() => {
              if (!version.selected) switchTo(version.classEntryId);
            }}
          >
            {versionText(version, versions)}
          </Button>
        ))}
      </div>
      <p id={descriptionId} className="text-muted-foreground text-xs">
        Change all {className} levels
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <SaveFeedback
          status={attempt ? status : idle}
          savedText="Class version saved."
          savingText="Saving…"
          shouldHideWhenIdle
        />
        {attempt && status.kind === 'error' ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs md:h-6"
            aria-describedby={reasonId}
            disabled={isDisabled}
            onClick={() => switchTo(attempt)}
          >
            Retry <span className="sr-only">version of {className}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
