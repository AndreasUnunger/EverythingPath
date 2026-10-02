'use client';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useCampaign } from '~/components/campaign-shell/campaign-context';
import { FailedLoadCard } from '~/components/campaign-shell/failed-load';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { campaignPath } from '~/lib/campaign-routes';

// A refused or failed sheet read keeps the campaign shell and shows no
// character data: retry re-renders only this page, Back returns to the
// Characters page it was opened from.
export default function CharacterSheetError({ reset }: { reset: () => void }) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();
  const { campaign } = useCampaign();
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <FailedLoadCard
        noun="The character sheet"
        retry={() => {
          resetQueries();
          reset();
        }}
      />
      <Button asChild variant="outline">
        <GuardedLink href={campaignPath(campaign._id, 'characters')}>
          Characters &amp; officers
        </GuardedLink>
      </Button>
    </main>
  );
}
