'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';
import { MilitiaSkeleton } from '~/components/militia-corrections/militia-skeleton';
import { parseMilitiaEntry } from '~/lib/militia-correction-sections';

// Thin address adapter: the entry to open lives in the address
// (`?section=teams`), so a link can land straight on one correction.
function MilitiaHost() {
  const { campaign, organizationId } = useCampaign();
  const params = useSearchParams();
  return (
    <MilitiaSection
      campaignId={campaign._id}
      organizationId={organizationId}
      initialEntry={parseMilitiaEntry(params.get('section'))}
    />
  );
}

export default function MilitiaPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl">Militia</h1>
      <Suspense fallback={<MilitiaSkeleton />}>
        <MilitiaHost />
      </Suspense>
    </main>
  );
}
