'use client';
import { Suspense, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { useCampaignWeek } from '~/components/campaign-home/use-campaign-week';
import { FinishedWeeksSkeleton } from '~/components/historical-week/finished-weeks-view';
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
  // The open week drives only the in-progress line and empty-state links.
  const campaignWeek = useCampaignWeek(campaignId);
  const select = useCallback(
    (next: HistorySelection) => router.push(historyPath(campaignId, next)),
    [campaignId, router],
  );
  return (
    <CanonicalHistoryScreen
      campaign={campaignId}
      selection={selection}
      select={select}
      campaignWeek={campaignWeek}
    />
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<FinishedWeeksSkeleton />}>
      <HistoryHost />
    </Suspense>
  );
}
