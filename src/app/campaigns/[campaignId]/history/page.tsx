'use client';
import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CanonicalHistoryScreen } from '~/components/historical-week/screen';
import {
  historyPath,
  parseHistorySelection,
  type HistorySelection,
} from '~/lib/campaign-routes';

// Week, record and audit paging live in the address so reload and browser
// Back/Forward return to the same record within the same campaign.
function HistoryHost() {
  const { campaign } = useCampaign();
  const params = useSearchParams();
  const router = useRouter();
  const selection = useMemo(() => parseHistorySelection(params), [params]);
  const campaignId = campaign._id;
  const select = useCallback(
    (next: HistorySelection) => router.push(historyPath(campaignId, next)),
    [campaignId, router],
  );
  return (
    <CanonicalHistoryScreen
      campaign={campaignId}
      selection={selection}
      select={select}
    />
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6">
          Loading history…
        </p>
      }
    >
      <HistoryHost />
    </Suspense>
  );
}
