'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { zid } from 'convex-helpers/server/zod4';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { Button } from '~/components/ui/button';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { weekPath } from '~/lib/campaign-routes';
import { MilitiaSetupForm } from './form';
function SetupCampaign({ campaignId }: { campaignId: Id<'campaign'> }) {
  const options = useQuery(api.canonicalSetup.options, { campaignId });
  const initialize = useMutation(api.canonicalSetup.initialize);
  const [initializationId] = useState(() => crypto.randomUUID());
  const router = useRouter();
  if (options === undefined) return <p role="status">Loading militia setup…</p>;
  if (!options)
    return <p role="status">Militia setup is unavailable for this campaign.</p>;
  if (options.started)
    return (
      <>
        <p role="status">Militia setup is complete.</p>
        <Button asChild>
          <GuardedLink href={weekPath(campaignId)}>
            Open current week
          </GuardedLink>
        </Button>
      </>
    );
  return (
    <MilitiaSetupForm
      characters={options.characters}
      onSave={async (setup) => {
        await initialize({ campaignId, initializationId, setup });
        router.push(weekPath(campaignId, setup.phase));
      }}
    />
  );
}
export function MilitiaSetupScreen({ campaign }: { campaign: string | null }) {
  const auth = useConvexAuth();
  const parsed = zid('campaign').safeParse(campaign);
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold">Set up militia</h1>
      {auth.isLoading ? (
        <p role="status">Loading militia setup…</p>
      ) : auth.isAuthenticated && parsed.success ? (
        <SetupCampaign campaignId={parsed.data} />
      ) : (
        <p role="status">Militia setup is unavailable for this campaign.</p>
      )}
    </main>
  );
}
