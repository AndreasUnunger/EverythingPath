'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { MilitiaSection } from '~/components/campaign-sections/militia-section';

export default function MilitiaPage() {
  const { campaign, organizationId } = useCampaign();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl">Militia</h1>
      <MilitiaSection
        campaignId={campaign._id}
        organizationId={organizationId}
      />
    </main>
  );
}
