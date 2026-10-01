'use client';
// PROTOTYPE — variant D's phone pattern: drill-down. A minimal bottom bar,
// Home · Characters · More, in the same order on every page, and all depth in
// the top bar: an Up button (one level up, where a back arrow usually sits)
// and the place title, which opens a "Where to" navigator listing everything
// in the organization as a tree, where you are marked. The militia's second
// level is reached from that navigator or from a hub list on the Militia
// summary page; the campaign's Characters page from the navigator or from
// Home's "All characters".
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  House,
  Map as MapIcon,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { cn } from '~/lib/utils';
import { campaignsInOrg, getOrg, type Campaign } from './mock';
import { isMilitiaPage, type Location, type Page } from './types';
import {
  militiaTabs,
  MoreTab,
  PAGE_LABEL,
  phoneAreaOf,
  PhoneBar,
  PhoneTab,
  sheetBack,
  type Icon,
  type PhoneProps,
} from './variant-c-parts';

/** One level up. Sheets go back to where they were opened from. */
function upOf(
  location: Location,
  campaign: Campaign | undefined,
): Location | undefined {
  const campaignId = campaign?.id;
  switch (location.page) {
    case 'sheet':
      return sheetBack(location);
    case 'week':
    case 'history':
    case 'officers':
    case 'setup':
      return { page: 'militia', campaignId };
    case 'militia':
    case 'campaign-characters':
      return { page: 'campaign-home', campaignId };
    case 'campaign-home':
      return { page: 'campaigns' };
    default:
      return undefined;
  }
}

function placeTitle(
  location: Location,
  campaign: Campaign | undefined,
  orgId: string,
): { title: string; subtitle: string } {
  if (location.page === 'campaigns')
    return { title: 'Campaigns', subtitle: getOrg(orgId)?.name ?? '' };
  if (location.page === 'characters')
    return { title: 'Characters', subtitle: 'Yours, across campaigns' };
  if (location.page === 'sheet')
    return {
      title: campaign?.name ?? 'Characters',
      subtitle: 'Character sheet',
    };
  if (!campaign) return { title: PAGE_LABEL[location.page], subtitle: '' };
  const label =
    location.page === 'week'
      ? `Week ${campaign.militia?.week ?? 0}`
      : PAGE_LABEL[location.page];
  return {
    title: campaign.name,
    subtitle:
      isMilitiaPage(location.page) && location.page !== 'militia'
        ? `Militia · ${label}`
        : label,
  };
}

function NavRow({
  icon: RowIcon,
  label,
  depth,
  current,
  onClick,
}: {
  icon: Icon;
  label: string;
  depth: 0 | 1 | 2;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 rounded-md pr-2 text-left text-sm outline-none focus-visible:ring-[3px]',
        depth === 0 && 'pl-2',
        depth === 1 && 'pl-9',
        depth === 2 && 'pl-16',
        current ? 'bg-foreground/10' : 'hover:bg-foreground/5',
      )}
    >
      <RowIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {current && <Check className="text-primary size-4" aria-hidden />}
    </button>
  );
}

/** Phone top-bar slot: Up (or the app icon at the root) and the place title. */
export function PhoneDrillTitle({
  location,
  campaign,
  context,
  orgId,
  go,
}: PhoneProps) {
  const [open, setOpen] = useState(false);
  const up = upOf(location, campaign);
  const { title, subtitle } = placeTitle(location, campaign, orgId);
  const org = getOrg(orgId);
  const expanded = campaign ?? context;
  const here = (page: Page, campaignId?: string) =>
    location.page === page && (location.campaignId ?? undefined) === campaignId;
  const jump = (to: Location) => {
    setOpen(false);
    go(to);
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
      {up ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={`Up to ${PAGE_LABEL[up.page]}`}
          onClick={() => go(up)}
        >
          <ChevronLeft className="size-5" />
        </Button>
      ) : (
        <KeepIcon className="text-primary mx-0.5 size-8 shrink-0" />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Where to"
          className="hover:bg-foreground/10 focus-visible:ring-ring/50 flex min-h-9 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left outline-none focus-visible:ring-[3px]"
        >
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-medium">{title}</span>
            {subtitle && (
              <span className="text-muted-foreground block truncate text-xs">
                {subtitle}
              </span>
            )}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader>
            <SheetTitle>Where to</SheetTitle>
            <SheetDescription>
              Everything in {org?.name ?? 'this organization'}; where you are is
              ticked.
            </SheetDescription>
          </SheetHeader>
          <nav
            aria-label="Where to"
            className="flex flex-col gap-0.5 px-2 pb-4"
          >
            <NavRow
              icon={MapIcon}
              label="Campaigns"
              depth={0}
              current={here('campaigns')}
              onClick={() => jump({ page: 'campaigns' })}
            />
            <NavRow
              icon={User}
              label="Characters"
              depth={0}
              current={here('characters')}
              onClick={() => jump({ page: 'characters' })}
            />
            <p className="text-muted-foreground mt-3 mb-1 px-2 text-xs tracking-widest uppercase">
              {org?.name ?? 'Organization'}
            </p>
            {campaignsInOrg(orgId).map((item) => (
              <div key={item.id} className="flex flex-col gap-0.5">
                <NavRow
                  icon={House}
                  label={item.name}
                  depth={0}
                  current={here('campaign-home', item.id)}
                  onClick={() =>
                    jump({ page: 'campaign-home', campaignId: item.id })
                  }
                />
                {item.id === expanded?.id && (
                  <>
                    <NavRow
                      icon={Users}
                      label="Characters"
                      depth={1}
                      current={here('campaign-characters', item.id)}
                      onClick={() =>
                        jump({
                          page: 'campaign-characters',
                          campaignId: item.id,
                        })
                      }
                    />
                    {item.militia && (
                      <>
                        <NavRow
                          icon={Shield}
                          label="Militia"
                          depth={1}
                          current={here('militia', item.id)}
                          onClick={() =>
                            jump({ page: 'militia', campaignId: item.id })
                          }
                        />
                        {militiaTabs(item)
                          .filter((tab) => tab.page !== 'militia')
                          .map((tab) => (
                            <NavRow
                              key={tab.page}
                              icon={tab.icon}
                              label={tab.label}
                              depth={2}
                              current={here(tab.page, item.id)}
                              onClick={() =>
                                jump({ page: tab.page, campaignId: item.id })
                              }
                            />
                          ))}
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Hub list on the Militia summary page: its second level, one tap away. */
export function PhoneMilitiaHub({
  campaign,
  go,
}: {
  campaign: Campaign;
  go: PhoneProps['go'];
}) {
  if (!campaign.militia) return null;
  return (
    <nav
      aria-label="Militia pages"
      className="mx-auto w-full max-w-6xl px-4 pt-4 md:hidden"
    >
      <ul className="border-foreground/15 divide-foreground/15 divide-y rounded-md border">
        {militiaTabs(campaign)
          .filter((tab) => tab.page !== 'militia')
          .map((tab) => {
            const TabIcon = tab.icon;
            return (
              <li key={tab.page}>
                <button
                  type="button"
                  onClick={() =>
                    go({ page: tab.page, campaignId: campaign.id })
                  }
                  className="hover:bg-foreground/5 focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
                >
                  <TabIcon
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                  <span className="flex-1">{tab.label}</span>
                  {tab.page === 'week' && (
                    <span className="bg-primary/15 text-primary rounded px-1 py-px font-mono text-[10px] tracking-wide uppercase">
                      current
                    </span>
                  )}
                  <ChevronRight
                    className="text-muted-foreground size-4"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
      </ul>
    </nav>
  );
}

export function PhoneDrillBar({
  location,
  campaign,
  context,
  orgId,
  setOrgId,
  go,
}: PhoneProps) {
  const area = phoneAreaOf(location, campaign);
  return (
    <PhoneBar>
      <PhoneTab
        icon={House}
        label="Home"
        active={area !== 'characters'}
        onClick={() =>
          context
            ? go({ page: 'campaign-home', campaignId: context.id })
            : go({ page: 'campaigns' })
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
  );
}
