'use client';
import type { Doc } from '@convex/_generated/dataModel';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { campaignPath, type CampaignSection } from '~/lib/campaign-routes';

const screens: { section: CampaignSection; label: string }[] = [
  { section: 'week', label: 'Open week' },
  { section: 'history', label: 'Finished weeks' },
  { section: 'militia', label: 'Militia' },
  { section: 'characters', label: 'Characters & officers' },
  { section: 'setup', label: 'Set up militia' },
];

// Temporary selected-campaign scaffold: the campaign's current screens as
// links. The Campaign list/home owner replaces it with the approved pane.
export function CampaignHomeLinks({ campaign }: { campaign: Doc<'campaign'> }) {
  return (
    <Card className="corner-brackets gap-4 p-4">
      <h2 className="text-primary font-sans text-2xl font-bold">
        {campaign.name}
      </h2>
      <nav aria-label={`${campaign.name} screens`}>
        <ul className="flex flex-wrap gap-2">
          {screens.map((item) => (
            <li key={item.section}>
              <Button asChild variant="outline">
                <GuardedLink href={campaignPath(campaign._id, item.section)}>
                  {item.label}
                </GuardedLink>
              </Button>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}

export function CampaignHome({ campaign }: { campaign: Doc<'campaign'> }) {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">Campaign</h1>
        <CreateCampaignDialog />
      </div>
      <CampaignHomeLinks campaign={campaign} />
    </main>
  );
}
