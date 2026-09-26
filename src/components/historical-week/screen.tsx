'use client';
import { useState } from 'react';
import { useConvexAuth } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { campaignPath, type HistorySelection } from '~/lib/campaign-routes';
import { HistoricalRecordView, provenanceLabels } from './record-view';
import {
  useCanonicalHistory,
  type CanonicalHistory as History,
} from './use-canonical-history';
type Selection = HistorySelection;
export function HistoricalWeekNavigation({
  history,
  select,
}: {
  history: History;
  select: (selection: Selection) => void;
}) {
  return (
    <>
      <nav aria-label="Historical weeks" className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={history.previousWeek === null}
          onClick={() => select({ week: history.previousWeek! })}
        >
          Previous week
        </Button>
        <Button
          variant="outline"
          disabled={history.nextWeek === null}
          onClick={() => select({ week: history.nextWeek! })}
        >
          Next week
        </Button>
        <Button variant="outline" onClick={() => select({})}>
          Latest finished week
        </Button>
      </nav>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Audit history</h2>
        <p className="text-muted-foreground text-sm">
          Each entry preserves its own complete account of this week.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => select({ week: history.week })}
          >
            Show effective record
          </Button>
          {history.audit.map((entry) => (
            <Button
              key={entry.recordId}
              variant={
                entry.recordId === history.record.recordId
                  ? 'default'
                  : 'outline'
              }
              aria-current={
                entry.recordId === history.record.recordId ? 'page' : undefined
              }
              onClick={() =>
                select({ week: history.week, recordId: entry.recordId })
              }
            >
              {provenanceLabels[entry.provenance]} · Entry {entry.sequence + 1}
            </Button>
          ))}
          {history.earlierSequence !== null && (
            <Button
              variant="outline"
              onClick={() =>
                select({
                  week: history.week,
                  recordId: history.record.recordId,
                  beforeSequence: history.earlierSequence!,
                })
              }
            >
              Earlier entries
            </Button>
          )}
        </div>
      </Card>
      <Card className="p-4 text-sm" aria-label="History correction">
        <h2 className="font-semibold">History correction</h2>
        <p>
          Corrections will be reviewed separately as a History Rewrite.
          Correction editing is not available yet.
        </p>
      </Card>
    </>
  );
}
// The selection is owned by the route so the address, reload and browser
// history carry the chosen week, record and audit page; the query payload is
// the existing one.
function HistoryBrowser({
  campaignId,
  selection,
  select,
}: {
  campaignId: Id<'campaign'>;
  selection: Selection;
  select: (selection: Selection) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const result = useCanonicalHistory(campaignId, selection, attempt);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <Button asChild variant="outline">
        <GuardedLink href={campaignPath(campaignId, 'week')}>
          Return to current week
        </GuardedLink>
      </Button>
      {result?.failed ? (
        <FailedLoadCard
          noun="Finished weeks"
          retry={() => setAttempt((value) => value + 1)}
        />
      ) : result?.data === undefined ? (
        <p role="status">Loading history…</p>
      ) : result.data === null ? (
        <p role="status">No finished weeks have been recorded.</p>
      ) : (
        <>
          <HistoricalWeekNavigation history={result.data} select={select} />
          <HistoricalRecordView
            record={result.data.record}
            effective={
              result.data.record.recordId === result.data.effectiveRecordId
            }
          />
        </>
      )}
    </main>
  );
}
export function CanonicalHistoryScreen({
  campaign,
  selection,
  select,
}: {
  campaign: string | null;
  selection: Selection;
  select: (selection: Selection) => void;
}) {
  const auth = useConvexAuth();
  const parsed = zid('campaign').safeParse(campaign);
  if (auth.isLoading)
    return (
      <p role="status" className="p-6">
        Loading history…
      </p>
    );
  if (!auth.isAuthenticated || !parsed.success)
    return (
      <p role="alert" className="p-6">
        Campaign history is unavailable.
      </p>
    );
  return (
    <HistoryBrowser
      key={parsed.data}
      campaignId={parsed.data}
      selection={selection}
      select={select}
    />
  );
}
