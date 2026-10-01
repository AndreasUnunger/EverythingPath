'use client';
// PROTOTYPE (throwaway, #208) — the approved shell's phone pattern
// (`app-shell-prototype/variant-c-phone.tsx`): four fixed bottom tabs,
// Campaign · Militia · Characters · More, and the current tab's pages in a
// strip under the top bar.
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
import { isMilitiaPage } from '../nav';
import type { Campaign, ProtoPage } from '../types';
import { campaignTabs, militiaTabs, type PhoneArea } from './model';
import { MoreTab, PhoneBar, PhoneTab } from './parts';

export type PhoneProps = {
  page: ProtoPage;
  /** The section lit for this page (a Character page borrows Back's). */
  section: ProtoPage;
  area: PhoneArea;
  /** The campaign of the page, if any. */
  campaign: Campaign | undefined;
  /** The campaign the bar acts for: the current one, else the last visited. */
  context: Campaign | undefined;
  go: (page: ProtoPage, campaignId?: string) => void;
};

export function PhoneTabsBar({
  page,
  area,
  campaign,
  context,
  go,
}: PhoneProps) {
  const [explain, setExplain] = useState(false);
  // The Militia tab reopens the militia page you left, like an iOS tab stack.
  const [lastMilitia, setLastMilitia] = useState<{
    campaignId: string;
    page: ProtoPage;
  }>();
  useEffect(() => {
    if (campaign && isMilitiaPage(page))
      setLastMilitia({ campaignId: campaign.id, page });
  }, [campaign, page]);
  const hasMilitia = Boolean(context?.militia);
  const militiaPage: ProtoPage =
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
            context ? go('campaign-home', context.id) : go('campaigns')
          }
        />
        <PhoneTab
          icon={Shield}
          label="Militia"
          active={area === 'militia'}
          disabled={!hasMilitia}
          onClick={() =>
            hasMilitia && context
              ? go(militiaPage, context.id)
              : setExplain(true)
          }
        />
        <PhoneTab
          icon={User}
          label="Characters"
          active={area === 'characters'}
          onClick={() => go('characters')}
        />
        <MoreTab />
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
                go('campaigns');
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

/**
 * The pages of the current bottom tab, under the top bar. Phone only. A
 * Character page keeps the strip of the tab it was opened from, with that
 * page lit; from the Characters area there is no strip.
 */
export function PhoneTabsStrip({ section, area, campaign, go }: PhoneProps) {
  if (!campaign || area === 'characters') return null;
  const inMilitia = area === 'militia' && campaign.militia !== null;
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
          active={tab.page === section}
          onClick={() => go(tab.page, campaign.id)}
        >
          {tab.label}
        </StripLink>
      ))}
    </nav>
  );
}
