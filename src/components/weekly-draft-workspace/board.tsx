'use client';
import { useEffect, useRef } from 'react';
import { useConvexAuth } from 'convex/react';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { campaignPath } from '~/lib/campaign-routes';
import { CampaignWorkspaceProvider } from './campaign-workspace-provider';
import {
  useWeeklyDraftWorkspace,
  useWorkspaceController,
  type WorkspaceController,
} from './use-weekly-draft-workspace';
import { SummaryView } from './summary-view';
import { PersistentView } from './persistent-view';
import { EventView } from './event-view';
import { ActivityView } from './activity-view';
import { UpkeepView } from './upkeep-view';
import type { Phase, WeeklyDraftWorkspace } from './types';
const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Summary',
};
// Real document departures (reload, close, typed address) get the browser's
// own warning, read from the store at event time. Same-document navigation
// consults the departure guard, which reads the same store.
function useBeforeUnloadWarning(
  store: WorkspaceController['store'] | undefined,
) {
  useEffect(() => {
    if (!store) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!store.getPendingWork()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [store]);
}
// The address is one player's Phase View. An actual address change (link,
// Back, Forward, the opening address) moves this Workspace once. A request
// made while the store is still loading is applied when it first becomes
// ready and then forgotten, so an arriving successor (ready → loading →
// ready) keeps its Upkeep reset, which is then published back into the
// address. The shell's owner cannot read the page's address during render,
// so this is what makes the opening phase authoritative.
function usePhaseAddress(
  store: WorkspaceController['store'] | undefined,
  workspace: WeeklyDraftWorkspace,
  phase: Phase | undefined,
  onPhaseChange: ((phase: Phase) => void) | undefined,
) {
  const requested = useRef(phase);
  const unapplied = useRef<Phase | undefined>(phase);
  const ready = workspace.status === 'ready';
  useEffect(() => {
    if (phase === undefined || !store) return;
    requested.current = phase;
    const current = store.getSnapshot();
    if (current.status === 'ready') {
      current.viewPhase(phase);
      unapplied.current = undefined;
    } else unapplied.current = phase;
  }, [phase, store]);
  useEffect(() => {
    if (!ready || !store || unapplied.current === undefined) return;
    const current = store.getSnapshot();
    if (current.status === 'ready') current.viewPhase(unapplied.current);
    unapplied.current = undefined;
  }, [ready, store]);
  const shown = ready ? workspace.phaseView.phase : null;
  useEffect(() => {
    if (shown === null || !onPhaseChange || shown === requested.current) return;
    // A render already superseded by a store-side change publishes nothing;
    // the next render compares the live phase.
    const live = store?.getSnapshot();
    if (live?.status === 'ready' && live.phaseView.phase !== shown) return;
    requested.current = shown;
    onPhaseChange(shown);
  }, [shown, onPhaseChange, store]);
  return (next: Phase) => {
    requested.current = next;
    if (workspace.status === 'ready') {
      workspace.viewPhase(next);
      unapplied.current = undefined;
    } else unapplied.current = next;
    onPhaseChange?.(next);
  };
}
export function WeeklyWorkspaceBoard({
  historyHref,
  setupHref,
  phase,
  onPhaseChange,
}: {
  historyHref?: string;
  setupHref?: string;
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  const auth = useConvexAuth();
  const workspace = useWeeklyDraftWorkspace();
  const controller = useWorkspaceController();
  useBeforeUnloadWarning(controller?.store);
  const choosePhase = usePhaseAddress(
    controller?.store,
    workspace,
    phase,
    onPhaseChange,
  );
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Loading the week…
      </p>
    );
  if (workspace.status !== 'ready')
    return (
      <main className="mx-auto w-full max-w-6xl p-4">
        <h1 className="mb-4 text-2xl">Weekly militia</h1>
        {workspace.status === 'failed' ? (
          <FailedLoadCard
            noun="The week"
            retry={controller?.retry ?? (() => window.location.reload())}
          />
        ) : (
          <Card className="p-6" role="status">
            {workspace.status === 'loading'
              ? 'Loading the week…'
              : 'No militia yet.'}
          </Card>
        )}
        {workspace.status === 'unavailable' && setupHref && (
          <Button asChild className="mt-4">
            <GuardedLink href={setupHref}>Set up militia</GuardedLink>
          </Button>
        )}
      </main>
    );
  const view = workspace.phaseView;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            Weekly militia
          </p>
          <h1 className="text-2xl">
            Week {workspace.week} · {phaseLabels[view.phase]}
          </h1>
        </div>
        <p role="status" aria-live="polite" className="text-sm">
          {workspace.feedback === 'pending'
            ? 'Saving changes…'
            : workspace.feedback === 'confirming'
              ? 'Confirming the week…'
              : workspace.feedback === 'failed'
                ? 'Changes could not be saved. The latest saved values are shown.'
                : workspace.feedback === 'saved'
                  ? 'Changes saved.'
                  : 'Prepare the week together.'}
        </p>
      </header>
      {workspace.setupNotes && (
        <aside
          aria-label="Setup notes"
          className="border-primary/40 bg-primary/10 border p-3 text-sm"
        >
          <h2 className="font-semibold">Setup notes</h2>
          <p>{workspace.setupNotes}</p>
        </aside>
      )}
      {historyHref && (
        <Button asChild variant="outline">
          <GuardedLink href={historyHref}>Finished weeks</GuardedLink>
        </Button>
      )}
      <nav aria-label="Week phases" className="flex flex-wrap gap-2">
        {workspace.phases.map((item) => (
          <Button
            key={item.phase}
            variant={view.phase === item.phase ? 'default' : 'outline'}
            aria-current={view.phase === item.phase ? 'page' : undefined}
            disabled={!item.available}
            onClick={() => choosePhase(item.phase)}
          >
            {phaseLabels[item.phase]}
          </Button>
        ))}
      </nav>
      {view.phase === 'upkeep' ? (
        <UpkeepView
          view={view}
          edit={workspace.edit}
          disabled={workspace.feedback === 'confirming'}
        />
      ) : view.phase === 'activity' ? (
        <ActivityView
          view={view}
          edit={workspace.edit}
          disabled={workspace.feedback === 'confirming'}
        />
      ) : view.phase === 'event' ? (
        <EventView
          view={view}
          edit={workspace.edit}
          disabled={workspace.feedback === 'confirming'}
        />
      ) : view.phase === 'persistent' ? (
        <PersistentView
          view={view}
          edit={workspace.edit}
          disabled={workspace.feedback === 'confirming'}
        />
      ) : view.phase === 'summary' ? (
        <SummaryView
          view={view}
          edit={workspace.edit}
          disabled={workspace.feedback === 'confirming'}
          canConfirm={workspace.canConfirm}
          forecastPending={workspace.forecastPending}
          reviewRequired={workspace.reviewRequired}
          confirm={() => {
            void workspace.confirm();
          }}
          review={() => choosePhase('summary')}
        />
      ) : null}
    </main>
  );
}
// Standalone host: the environment owner plus the board. The campaign shell
// mounts the owner itself so the Week route only renders the board.
export function CanonicalWorkspaceScreen({
  campaign,
  phase,
  onPhaseChange,
}: {
  campaign: string | null;
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  return (
    <CampaignWorkspaceProvider
      campaignId={campaign}
      active
      openingPhase={phase}
    >
      <WeeklyWorkspaceBoard
        phase={phase}
        onPhaseChange={onPhaseChange}
        setupHref={campaign ? campaignPath(campaign, 'setup') : undefined}
        historyHref={campaign ? campaignPath(campaign, 'history') : undefined}
      />
    </CampaignWorkspaceProvider>
  );
}
