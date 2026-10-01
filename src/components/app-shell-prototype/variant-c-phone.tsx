'use client';
// PROTOTYPE — variant C's phone pattern: four fixed bottom tabs, in the same
// order on every page. Campaign · Militia · Characters · More.
//   Campaign    the current (or last visited) campaign's Home; the Campaigns
//               list when you have not opened one yet.
//   Militia     that campaign's militia, reopening the page you left it on
//               (Week 12 the first time). Dimmed, never hidden, when the
//               campaign has none; tapping it says why.
//   Characters  the Characters area (yours, across campaigns).
//   More        organization and account.
// The pages of the current tab sit in a strip under the top bar: Home ·
// Characters for the Campaign tab, Week 12 · Finished weeks · Militia ·
// Characters & officers · Setup for the Militia tab. Nothing in the strip
// is reachable from the bar, and nothing in the bar from the strip.
import { Map as MapIcon, Shield, User } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { isMilitiaPage, type Page } from './types';
import {
  campaignTabs,
  militiaTabs,
  MoreTab,
  phoneAreaOf,
  PhoneBar,
  PhoneTab,
  type PhoneProps,
} from './variant-c-parts';

export function PhoneTabsBar({
  location,
  campaign,
  context,
  orgId,
  setOrgId,
  go,
}: PhoneProps) {
  const area = phoneAreaOf(location, campaign);
  const [explain, setExplain] = useState(false);
  // The Militia tab reopens the militia page you left, like an iOS tab stack.
  const [lastMilitia, setLastMilitia] = useState<{
    campaignId: string;
    page: Page;
  }>();
  useEffect(() => {
    if (campaign && isMilitiaPage(location.page))
      setLastMilitia({ campaignId: campaign.id, page: location.page });
  }, [campaign, location.page]);
  const hasMilitia = Boolean(context?.militia);
  const militiaPage: Page =
    lastMilitia && lastMilitia.campaignId === context?.id
      ? lastMilitia.page
      : 'week';

  return (
    <>
      <PhoneBar>
        <PhoneTab
          icon={MapIcon}
          label="Campaign"
          active={area === 'campaign'}
          onClick={() =>
            context
              ? go({ page: 'campaign-home', campaignId: context.id })
              : go({ page: 'campaigns' })
          }
        />
        <PhoneTab
          icon={Shield}
          label="Militia"
          active={area === 'militia'}
          disabled={!hasMilitia}
          onClick={() =>
            hasMilitia && context
              ? go({ page: militiaPage, campaignId: context.id })
              : setExplain(true)
          }
        />
        <PhoneTab
          icon={User}
          label="Characters"
          active={area === 'characters'}
          onClick={() => go({ page: 'characters' })}
        />
        <MoreTab orgId={orgId} setOrgId={setOrgId} />
      </PhoneBar>
      <Sheet open={explain} onOpenChange={setExplain}>
        <SheetContent
          side="bottom"
          className="pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <SheetHeader>
            <SheetTitle>No militia here</SheetTitle>
            <SheetDescription>
              {context
                ? `${context.name} has no militia; it tracks characters only. The Militia tab follows the campaign you are in.`
                : 'Open a campaign first. The Militia tab follows the campaign you are in.'}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => {
                setExplain(false);
                go({ page: 'campaigns' });
              }}
            >
              {context ? 'Switch campaign' : 'Open Campaigns'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function StripLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active)
      ref.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [active]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 min-h-9 shrink-0 rounded-md px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-[3px]',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
      )}
    >
      {children}
    </button>
  );
}

/** The pages of the current bottom tab, under the top bar. Phone only. */
export function PhoneTabsStrip({ location, campaign, go }: PhoneProps) {
  if (!campaign || location.page === 'sheet') return null;
  const inMilitia = isMilitiaPage(location.page) && campaign.militia !== null;
  const tabs = inMilitia
    ? militiaTabs(campaign)
    : campaignTabs(campaign).filter((tab) => tab.page !== 'militia');
  return (
    <nav
      aria-label={inMilitia ? 'Militia pages' : 'Campaign pages'}
      className="flex gap-1 overflow-x-auto px-2 pb-1.5 [scrollbar-width:none] md:hidden"
    >
      {tabs.map((tab) => (
        <StripLink
          key={tab.page}
          active={tab.page === location.page}
          onClick={() => go({ page: tab.page, campaignId: campaign.id })}
        >
          {tab.label}
        </StripLink>
      ))}
    </nav>
  );
}
