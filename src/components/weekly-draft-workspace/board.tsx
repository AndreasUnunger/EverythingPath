'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvex, useConvexAuth } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { useWeekLabel } from '~/components/campaign-shell/campaign-context';
import {
  GuardedLink,
  useNavigationGuard,
} from '~/components/campaign-shell/navigation-guard';
import { campaignPath } from '~/lib/campaign-routes';
import {
  WeeklyDraftWorkspaceProvider,
  useWeeklyDraftWorkspace,
} from './use-weekly-draft-workspace';
import { createConvexWorkspaceGateway } from './gateway';
import { SummaryView } from './summary-view';
import { PersistentView } from './persistent-view';
import { EventView } from './event-view';
import { ActivityView } from './activity-view';
import { UpkeepView } from './upkeep-view';
import type { Phase } from './types';
const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Summary',
};
// Real document navigation (reload, typed address) still gets the browser's
// own warning; shell links consult the navigation guard instead.
function usePendingExitWarning(pending: boolean) {
  const guard = useNavigationGuard();
  const { setPending } = guard;
  useEffect(() => {
    setPending(pending);
    return () => setPending(false);
  }, [pending, setPending]);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);
}
function useWeekAnnouncement(week: number | null) {
  const { setWeek } = useWeekLabel();
  useEffect(() => {
    setWeek(week);
    return () => setWeek(null);
  }, [week, setWeek]);
}
// The address is one player's Phase View. Address changes (links, Back and
// Forward) move this Workspace; a Workspace-side change such as the next
// week arriving on Upkeep is reflected back into the address.
function usePhaseAddress(
  workspace: ReturnType<typeof useWeeklyDraftWorkspace>,
  phase: Phase | undefined,
  onPhaseChange: ((phase: Phase) => void) | undefined,
) {
  const requested = useRef(phase);
  const viewPhase = workspace.status === 'ready' ? workspace.viewPhase : null;
  const shown = workspace.status === 'ready' ? workspace.phaseView.phase : null;
  useEffect(() => {
    if (phase === undefined) return;
    requested.current = phase;
    viewPhase?.(phase);
  }, [phase, viewPhase]);
  useEffect(() => {
    if (shown === null || !onPhaseChange || shown === requested.current) return;
    requested.current = shown;
    onPhaseChange(shown);
  }, [shown, onPhaseChange]);
  return (next: Phase) => {
    requested.current = next;
    viewPhase?.(next);
    onPhaseChange?.(next);
  };
}
export function WeeklyWorkspaceBoard({
  historyHref,
  setupHref,
  phase,
  onPhaseChange,
  retry,
}: {
  historyHref?: string;
  setupHref?: string;
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
  retry?: () => void;
}) {
  const workspace = useWeeklyDraftWorkspace();
  usePendingExitWarning(workspace.status === 'ready' && workspace.pendingWork);
  useWeekAnnouncement(workspace.status === 'ready' ? workspace.week : null);
  const choosePhase = usePhaseAddress(workspace, phase, onPhaseChange);
  if (workspace.status !== 'ready')
    return (
      <main className="mx-auto w-full max-w-6xl p-4">
        <h1 className="mb-4 text-2xl">Weekly militia</h1>
        {workspace.status === 'failed' ? (
          <FailedLoadCard
            noun="The week"
            retry={retry ?? (() => window.location.reload())}
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
// One gateway per campaign and sign-in; the opening phase is read once so a
// later address change never rebuilds the Workspace store.
export function CanonicalWorkspaceScreen({
  campaign,
  phase,
  onPhaseChange,
}: {
  campaign: string | null;
  phase?: Phase;
  onPhaseChange?: (phase: Phase) => void;
}) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const [attempt, setAttempt] = useState(0);
  const opening = useRef(phase);
  // A new attempt rebuilds the store for a page-local retry.
  const gateway = useMemo(() => {
    const parsed = zid('campaign').safeParse(campaign);
    return parsed.success && auth.isAuthenticated && attempt >= 0
      ? createConvexWorkspaceGateway(convex, parsed.data, opening.current)
      : null;
  }, [campaign, convex, auth.isAuthenticated, attempt]);
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Loading the week…
      </p>
    );
  return (
    <WeeklyDraftWorkspaceProvider gateway={gateway}>
      <WeeklyWorkspaceBoard
        phase={phase}
        onPhaseChange={onPhaseChange}
        retry={() => setAttempt((value) => value + 1)}
        setupHref={campaign ? campaignPath(campaign, 'setup') : undefined}
        historyHref={campaign ? campaignPath(campaign, 'history') : undefined}
      />
    </WeeklyDraftWorkspaceProvider>
  );
}
