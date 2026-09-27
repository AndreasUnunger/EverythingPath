import type { CanonicalResolutionPreview } from '~/lib/canonical-weekly-resolution';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import type { WorkspaceSource } from '~/lib/weekly-workspace-source';
import { phaseView } from './phase-view';
import { summaryMessage } from './summary-messages';
import type { Phase, PhaseReadiness } from './types';

const phaseOrder: Phase[] = [
  'upkeep',
  'activity',
  'event',
  'persistent',
  'summary',
];

export function derivePhaseReadiness(
  draft: WeeklyDraft,
  source: WorkspaceSource,
  preview: CanonicalResolutionPreview,
) {
  const views = phaseOrder.map((phase) =>
    phaseView(phase, draft, source, preview),
  );
  const summary = views.find((view) => view.phase === 'summary')!;
  const phases: PhaseReadiness[] = views.map((view) => ({
    phase: view.phase,
    available:
      view.phase !== 'persistent' || draft.context.persistentPhaseEligible,
    ...(view.phase === 'upkeep' ? { skipped: view.skipped } : {}),
    ready: view.ready,
    requirements: [...new Set(view.requirements)].map((id) => ({
      id,
      message: summaryMessage(id, summary),
    })),
    warnings: [...new Set(view.warnings)].map((id) => ({
      id,
      message: summaryMessage(id, summary, true),
    })),
  }));
  return { views, phases };
}

export function phaseNavigation(phase: Phase, phases: PhaseReadiness[]) {
  const available = phases.filter((item) => item.available);
  const index = available.findIndex((item) => item.phase === phase);
  return {
    previous: available[index - 1]?.phase ?? null,
    next: available[index + 1]?.phase ?? null,
  };
}

export function confirmationDisabledReason({
  canConfirm,
  confirming,
  reviewRequired,
  forecastPending,
  pendingWork,
  decisions,
}: {
  canConfirm: boolean;
  confirming: boolean;
  reviewRequired: boolean;
  forecastPending: boolean;
  pendingWork: boolean;
  decisions: number;
}) {
  if (confirming) return 'Confirming the week…';
  if (reviewRequired) return 'Review the updated week before confirming.';
  if (forecastPending || pendingWork)
    return 'Review will be ready when your changes are saved.';
  if (canConfirm) return null;
  if (decisions)
    return `${decisions} ${decisions === 1 ? 'decision' : 'decisions'} left`;
  return 'Review the updated week before confirming.';
}
