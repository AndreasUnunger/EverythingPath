import { Check, TriangleAlert, X } from 'lucide-react';
import { cn } from '~/lib/utils';
import { fieldLabel } from './sheet-parts';
import {
  PrerequisiteProse,
  PrerequisiteStatusChip,
} from './prerequisite-status';
import type { SelectionPreview } from './selection-view-types';

const prerequisiteChecks = new Set([
  'prerequisites.current',
  'prerequisites.recordedLevel',
  'proficiencyPrerequisite',
]);

function CheckList({
  label,
  checks,
}: {
  label: string;
  checks: SelectionPreview['checks'];
}) {
  if (checks.length === 0) return null;
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
      {checks.map((check) => (
        <li
          key={`${check.view}:${check.clauseIndex}`}
          className={cn(
            'flex min-w-0 items-center gap-1 [overflow-wrap:anywhere]',
            check.met ? 'text-muted-foreground' : 'text-amber-300',
          )}
        >
          {check.met ? (
            <Check aria-hidden className="size-3.5 shrink-0" />
          ) : (
            <X aria-hidden className="size-3.5 shrink-0" />
          )}
          <span>
            {check.label}
            <span className="sr-only">{check.met ? ' met' : ' not met'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What a candidate would mean in this slot, before it is saved: its
 * prerequisites now and at the recorded level, each checkable clause met or
 * not, the catalog's prose, and the other advisories it would raise. None of
 * it blocks adding the candidate, and nothing here can be accepted yet.
 */
export function SelectionPreviewDetails({
  preview,
  recordedLevelLabel,
}: {
  preview: SelectionPreview;
  /** "Prerequisites at recorded level N", while a level is chosen. */
  recordedLevelLabel: string | null;
}) {
  const current = preview.checks.filter((check) => check.view === 'current');
  const recorded = preview.checks.filter((check) => check.view === 'recorded');
  const advisories = preview.warnings.filter(
    (warning) =>
      warning.kind === 'rules' && !prerequisiteChecks.has(warning.check),
  );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <PrerequisiteStatusChip status={preview.currentStatus} />
      </div>
      <CheckList label="Prerequisites now" checks={current} />
      {recordedLevelLabel && preview.recordedStatus !== null ? (
        <div className="flex flex-col gap-0.5">
          <p className={fieldLabel}>{recordedLevelLabel}</p>
          <PrerequisiteStatusChip
            status={preview.recordedStatus}
            className="self-start"
          />
          <CheckList label={recordedLevelLabel} checks={recorded} />
        </div>
      ) : null}
      <PrerequisiteProse text={preview.prerequisiteText} />
      {advisories.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-amber-300">
          {advisories.map((warning) => (
            <li
              key={`${warning.check}:${warning.subject}`}
              className="flex items-start gap-1.5 [overflow-wrap:anywhere]"
            >
              <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0">{warning.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
