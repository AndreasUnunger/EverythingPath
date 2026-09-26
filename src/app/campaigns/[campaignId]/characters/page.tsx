'use client';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { CharactersSection } from '~/components/campaign-sections/characters-section';

export default function CharactersPage() {
  const { campaign, organizationId } = useCampaign();
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl">Characters &amp; officers</h1>
      <CharactersSection
        campaignId={campaign._id}
        organizationId={organizationId}
      />
    </main>
  );
}
