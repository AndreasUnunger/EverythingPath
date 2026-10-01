'use client';
// PROTOTYPE variant B — placeholder, replaced by the variant agent.
import { KeepIcon } from '~/components/keepIcon';
import { campaignsInOrg, getCampaign, useMockStore } from './mock';
import { MockAvatar, MockOrgSwitcher, NavLink } from './parts';
import { campaignOf, isMilitiaPage, type Page, type ShellProps } from './types';

const CAMPAIGN_PAGES: { page: Page; label: string }[] = [
  { page: 'campaign-home', label: 'Home' },
  { page: 'campaign-characters', label: 'Characters' },
  { page: 'week', label: 'Week' },
  { page: 'history', label: 'Finished weeks' },
  { page: 'militia', label: 'Militia' },
  { page: 'officers', label: 'Characters & officers' },
  { page: 'setup', label: 'Setup' },
];

export function VariantB({
  location,
  go,
  orgId,
  setOrgId,
  content,
}: ShellProps) {
  useMockStore();
  const campaignId = campaignOf(location) ?? campaignsInOrg(orgId)[0]?.id;
  const campaign = getCampaign(campaignId);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-wrap items-center gap-x-2 gap-y-1 border-b px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2">
        <KeepIcon className="text-primary size-8" />
        <NavLink
          active={location.page === 'campaigns'}
          onClick={() => go({ page: 'campaigns' })}
        >
          Campaigns
        </NavLink>
        <NavLink
          active={location.page === 'characters'}
          onClick={() => go({ page: 'characters' })}
        >
          Characters
        </NavLink>
        {campaign && (
          <>
            <span className="text-muted-foreground text-sm">
              / {campaign.name}
            </span>
            {CAMPAIGN_PAGES.filter(
              (item) => campaign.militia !== null || !isMilitiaPage(item.page),
            ).map((item) => (
              <NavLink
                key={item.page}
                active={location.page === item.page}
                onClick={() => go({ page: item.page, campaignId: campaign.id })}
              >
                {item.label}
              </NavLink>
            ))}
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <MockOrgSwitcher value={orgId} onChange={setOrgId} />
          <MockAvatar />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
    </div>
  );
}
