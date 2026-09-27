'use client';
import type { Doc } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { Button } from '~/components/ui/button';
import { campaignPath, type CampaignSection } from '~/lib/campaign-routes';

const screens: { section: CampaignSection; label: string }[] = [
  { section: 'week', label: 'Open week' },
  { section: 'history', label: 'Finished weeks' },
  { section: 'militia', label: 'Militia' },
  { section: 'characters', label: 'Characters & officers' },
  { section: 'setup', label: 'Set up militia' },
];

// The selected campaign's home content below its header. Until the richer
// home content (Continue week, the militia summary, recent finished weeks
// and Characters & officers, #189) replaces it, every existing destination
// stays one link away, Set up militia included.
export function CampaignHomeContent({
  campaign,
}: {
  campaign: Doc<'campaign'>;
}) {
  return (
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
  );
}
