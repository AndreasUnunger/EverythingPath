'use client';
import { useEffect, useMemo } from 'react';
import { useConvex, useConvexAuth } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import {
  WeeklyDraftWorkspaceProvider,
  useWeeklyDraftWorkspace,
} from './use-weekly-draft-workspace';
import { createConvexWorkspaceGateway } from './gateway';
import { UpkeepView } from './upkeep-view';
import type { Phase } from './types';
const phaseLabels: Record<Phase, string> = {
  upkeep: 'Upkeep',
  activity: 'Activity',
  event: 'Event',
  persistent: 'Persistent',
  summary: 'Summary',
};
function usePendingExitWarning(pending: boolean) {
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
export function WeeklyWorkspaceBoard() {
  const workspace = useWeeklyDraftWorkspace();
  usePendingExitWarning(workspace.status === 'ready' && workspace.pendingWork);
  if (workspace.status !== 'ready')
    return (
      <main className="mx-auto w-full max-w-6xl p-4">
        <h1 className="mb-4 text-2xl">Weekly militia</h1>
        <Card
          className="p-6"
          role={workspace.status === 'failed' ? 'alert' : 'status'}
        >
          {workspace.status === 'loading' ? (
            'Loading the week…'
          ) : workspace.status === 'unavailable' ? (
            'This week is unavailable.'
          ) : (
            <>
              The week could not be loaded.{' '}
              <Button variant="link" onClick={() => window.location.reload()}>
                Reload the week
              </Button>
            </>
          )}
        </Card>
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
      <nav aria-label="Week phases" className="flex flex-wrap gap-2">
        {workspace.phases.map((item) => (
          <Button
            key={item.phase}
            variant={view.phase === item.phase ? 'default' : 'outline'}
            aria-current={view.phase === item.phase ? 'page' : undefined}
            disabled={!item.available}
            onClick={() => workspace.viewPhase(item.phase)}
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
      ) : view.phase === 'summary' ? (
        <Card className="space-y-3 p-5">
          <h2 className="text-lg font-semibold">Review the week</h2>
          {view.outcome && (
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt>Training</dt>
                <dd className="font-mono text-xl">
                  {view.outcome.militiaSnapshot.training}
                </dd>
              </div>
              <div>
                <dt>Treasury</dt>
                <dd className="font-mono text-xl">
                  {view.outcome.militiaSnapshot.treasuryCopper} cp
                </dd>
                {view.baseline &&
                  view.baseline.militiaSnapshot.treasuryCopper !==
                    view.outcome.militiaSnapshot.treasuryCopper && (
                    <dd className="text-muted-foreground text-xs">
                      Rules baseline:{' '}
                      {view.baseline.militiaSnapshot.treasuryCopper} cp
                    </dd>
                  )}
              </div>
              <div>
                <dt>Next week</dt>
                <dd className="font-mono text-xl">{view.outcome.week}</dd>
              </div>
            </dl>
          )}
          <p className="text-sm">
            {workspace.forecastPending
              ? 'Review will be ready when your changes are saved.'
              : view.ready
                ? 'The week is ready for confirmation.'
                : 'Some rolls or decisions still need attention.'}
          </p>
          <Button
            disabled={!workspace.canConfirm}
            onClick={() => {
              void workspace.confirm();
            }}
          >
            Confirm week
          </Button>
        </Card>
      ) : (
        <Card className="space-y-2 p-5">
          <h2 className="text-lg font-semibold">{phaseLabels[view.phase]}</h2>
          <p className="text-sm">
            {view.ready
              ? 'This phase is ready.'
              : 'This phase needs more preparation.'}
          </p>
          {view.phase === 'activity' && (
            <p className="text-sm">Staged actions: {view.occupiedSlots}</p>
          )}
        </Card>
      )}
    </main>
  );
}
export function CanonicalWorkspaceScreen({
  campaign,
}: {
  campaign: string | null;
}) {
  const convex = useConvex();
  const auth = useConvexAuth();
  const gateway = useMemo(() => {
    const parsed = zid('campaign').safeParse(campaign);
    return parsed.success && auth.isAuthenticated
      ? createConvexWorkspaceGateway(convex, parsed.data)
      : null;
  }, [campaign, convex, auth.isAuthenticated]);
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Loading the week…
      </p>
    );
  return (
    <WeeklyDraftWorkspaceProvider gateway={gateway}>
      <WeeklyWorkspaceBoard />
    </WeeklyDraftWorkspaceProvider>
  );
}
