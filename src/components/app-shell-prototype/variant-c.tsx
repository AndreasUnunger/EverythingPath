'use client';
// PROTOTYPE variant C — "Militia rail". One calm top bar row everywhere: a
// combined place picker (campaign or area), the campaign pages as section
// links, org switcher and avatar. Inside Militia the second level is a
// vertical rail (icons only at tablet widths) instead of a second bar. The
// sheet is a focused page with its own sticky sub-header. On phone one
// bottom bar follows context.
import {
  ArrowLeft,
  Hammer,
  History,
  House,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '~/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import {
  addToCampaign,
  buildOut,
  campaignsInOrg,
  getCampaign,
  getCharacter,
  getOrg,
  leaveCampaign,
  levelLine,
  orgs,
  useMockStore,
  type Campaign,
} from './mock';
import { MockAvatar, MockOrgSwitcher, NavLink, StatusBadge } from './parts';
import {
  campaignOf,
  isCampaignPage,
  isMilitiaPage,
  type Location,
  type Page,
  type ShellProps,
} from './types';

type Icon = typeof LayoutGrid;
type Tab = { page: Page; label: string; short: string; icon: Icon };

const TOP_TABS: Tab[] = [
  { page: 'campaigns', label: 'Campaigns', short: 'Campaigns', icon: MapIcon },
  { page: 'characters', label: 'Characters', short: 'Characters', icon: User },
];

function campaignTabs(campaign: Campaign): Tab[] {
  return [
    { page: 'campaign-home', label: 'Home', short: 'Home', icon: House },
    {
      page: 'campaign-characters',
      label: 'Characters',
      short: 'Characters',
      icon: Users,
    },
    ...(campaign.militia
      ? [{ page: 'militia' as Page, label: 'Militia', short: 'Militia', icon: Shield }]
      : []),
  ];
}

function militiaTabs(campaign: Campaign): Tab[] {
  const week = campaign.militia?.week ?? 0;
  return [
    { page: 'week', label: `Week ${week}`, short: 'Week', icon: LayoutGrid },
    { page: 'history', label: 'Finished weeks', short: 'Finished', icon: History },
    { page: 'militia', label: 'Militia', short: 'Militia', icon: Shield },
    {
      page: 'officers',
      label: 'Characters & officers',
      short: 'Characters',
      icon: Users,
    },
  ];
}

const SETUP: Tab = { page: 'setup', label: 'Setup', short: 'Setup', icon: Settings };

const PAGE_LABEL: Record<Page, string> = {
  campaigns: 'Campaigns',
  characters: 'My characters',
  'campaign-home': 'Home',
  'campaign-characters': 'Characters',
  week: 'Week',
  history: 'Finished weeks',
  militia: 'Militia',
  officers: 'Characters & officers',
  setup: 'Setup',
  sheet: 'Sheet',
};

/**
 * The section the location belongs to, for highlighting: a sheet borrows the
 * section it was opened from (so Militia stays lit when you came from the
 * roster), otherwise Characters of its context.
 */
function sectionOf(location: Location, inCampaign: boolean): Page {
  if (location.page !== 'sheet') return location.page;
  if (location.from && isCampaignPage(location.from) === inCampaign)
    return location.from;
  return inCampaign ? 'campaign-characters' : 'characters';
}

/** Does the section link for `tab` light up for the current section? */
function tabActive(tab: Tab, section: Page) {
  if (tab.page === 'militia' && isMilitiaPage(section)) return true;
  return tab.page === section;
}

const WIDE = '(min-width: 1280px)';
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

// Place picker: one Select over the two top-level areas and the active
// organization's campaigns. Its value is where you are.
function PlacePicker({
  location,
  campaign,
  orgId,
  go,
  className,
}: {
  location: Location;
  campaign: Campaign | undefined;
  orgId: string;
  go: ShellProps['go'];
  className?: string;
}) {
  const value =
    campaign?.id ??
    (location.page === 'characters' ||
    (location.page === 'sheet' && !campaign)
      ? 'characters'
      : 'campaigns');
  const org = getOrg(orgId);
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === 'campaigns') go({ page: 'campaigns' });
        else if (next === 'characters') go({ page: 'characters' });
        else go({ page: 'campaign-home', campaignId: next });
      }}
    >
      <SelectTrigger
        aria-label="Where you are"
        title={campaign?.name}
        className={cn(
          'hover:bg-foreground/10 min-h-9 min-w-0 border-0 bg-transparent px-2 text-sm font-medium shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate md:text-base dark:bg-transparent',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="campaigns" className="min-h-11">
          Campaigns
        </SelectItem>
        <SelectItem value="characters" className="min-h-11">
          My characters
        </SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel className="text-xs tracking-widest uppercase">
            {org?.name ?? 'Organization'}
          </SelectLabel>
          {campaignsInOrg(orgId).map((item) => (
            <SelectItem key={item.id} value={item.id} className="min-h-11">
              {item.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

// Militia rail (≥ md). Labels show from 1280px or when pinned open; below
// that it is an icon column with tooltips. Setup sits at the bottom.
function MilitiaRail({
  campaign,
  section,
  go,
}: {
  campaign: Campaign;
  section: Page;
  go: ShellProps['go'];
}) {
  const wide = useWide();
  const [pinned, setPinned] = useState<boolean | null>(null);
  const open = pinned ?? wide;
  const week = campaign.militia?.week ?? 0;

  const item = (tab: Tab, extra?: ReactNode) => {
    const active = tab.page === section;
    const TabIcon = tab.icon;
    const button = (
      <button
        type="button"
        onClick={() => go({ page: tab.page, campaignId: campaign.id })}
        aria-current={active ? 'page' : undefined}
        aria-label={open ? undefined : tab.label}
        className={cn(
          'focus-visible:ring-ring/50 flex min-h-10 w-full items-center gap-3 rounded-md text-sm outline-none focus-visible:ring-[3px]',
          open ? 'px-3' : 'justify-center px-0',
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
        )}
      >
        <span className="relative shrink-0">
          <TabIcon className="size-5" aria-hidden />
          {!open && tab.page === 'week' && (
            <span
              aria-hidden
              className="bg-primary text-primary-foreground absolute -top-1.5 -right-2.5 rounded-full px-1 font-mono text-[10px] leading-4"
            >
              {week}
            </span>
          )}
        </span>
        {open && (
          <span className="flex min-w-0 flex-1 items-center gap-2 text-left leading-tight">
            {tab.label}
            {extra}
          </span>
        )}
      </button>
    );
    if (open) return button;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={6}>
          {tab.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      aria-label="Militia"
      className={cn(
        'bg-sidebar/60 border-sidebar-border hidden shrink-0 flex-col gap-1 border-r p-2 md:flex',
        open ? 'w-56' : 'w-14',
      )}
    >
      <div
        className={cn(
          'flex items-center pt-1 pb-2',
          open ? 'justify-between pl-3' : 'justify-center',
        )}
      >
        {open && (
          <p className="text-muted-foreground text-xs tracking-widest uppercase">
            Militia
          </p>
        )}
        <button
          type="button"
          onClick={() => setPinned(!open)}
          aria-pressed={open}
          aria-label={open ? 'Collapse rail' : 'Expand rail'}
          title={open ? 'Collapse rail' : 'Expand rail'}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          {open ? (
            <PanelLeftClose className="size-4" aria-hidden />
          ) : (
            <PanelLeftOpen className="size-4" aria-hidden />
          )}
        </button>
      </div>
      <nav aria-label="Militia sections" className="flex flex-col gap-1">
        {item(
          { ...militiaTabs(campaign)[0]!, label: `Week ${week}` },
          <span className="bg-primary/15 text-primary rounded px-1 py-px font-mono text-[10px] tracking-wide uppercase">
            current
          </span>,
        )}
        {militiaTabs(campaign)
          .slice(1)
          .map((tab) => (
            <span key={tab.page}>{item(tab)}</span>
          ))}
      </nav>
      {/* pb clears the harness's dev badge (prototype only). */}
      <div className="mt-auto flex flex-col gap-1 pb-24">
        <hr className="border-sidebar-border my-1" />
        {item(SETUP)}
      </div>
    </aside>
  );
}

// Sheet sub-header: back to where you came from, identity, status and
// membership. Sticky so the actions stay at hand while the sheet scrolls.
function SheetSubHeader({
  location,
  go,
}: {
  location: Location;
  go: ShellProps['go'];
}) {
  const character = getCharacter(location.characterId);
  if (!character) return null;
  const campaign = getCampaign(character.campaignId);
  const from = location.from ?? (campaign ? 'campaign-characters' : 'characters');
  const back: Location = isCampaignPage(from)
    ? campaign
      ? { page: from, campaignId: campaign.id }
      : { page: 'characters' }
    : { page: from };
  const militiaOnly = character.status === 'militia-only';
  return (
    <div className="bg-background/95 border-foreground/15 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9 shrink-0 px-2"
          onClick={() => go(back)}
          aria-label={`Back to ${PAGE_LABEL[back.page]}`}
        >
          <ArrowLeft /> <span className="hidden sm:inline">{PAGE_LABEL[back.page]}</span>
        </Button>
        <span className="min-w-[9rem] flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{character.name}</span>
            <StatusBadge status={character.status} />
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {levelLine(character)}
            {campaign ? ` · ${campaign.name}` : ' · no campaign'}
            {campaign?.militia &&
              (character.onRoster
                ? ` · on roster${character.officer ? ` · ${character.officer}` : ''}`
                : ' · off roster')}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {militiaOnly && (
            <Button
              type="button"
              size="sm"
              className="min-h-9"
              onClick={() => buildOut(character.id)}
            >
              <Hammer /> Build out
            </Button>
          )}
          {campaign ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => leaveCampaign(character.id)}
            >
              <LogOut /> <span className="hidden sm:inline">Leave campaign</span>
              <span className="sm:hidden">Leave</span>
            </Button>
          ) : (
            <Select
              value=""
              onValueChange={(campaignId) =>
                addToCampaign(character.id, campaignId)
              }
            >
              <SelectTrigger
                aria-label="Add to campaign"
                className="bg-primary text-primary-foreground hover:bg-primary/90 data-[placeholder]:text-primary-foreground min-h-9 gap-1.5 border-0 px-3 text-sm font-medium shadow-xs [&_svg:not([class*='text-'])]:text-primary-foreground [&_svg]:opacity-100"
              >
                <UserPlus className="size-4" aria-hidden />
                <span className="hidden sm:inline">Add to campaign</span>
                <span className="sm:hidden">Add</span>
              </SelectTrigger>
              <SelectContent align="end">
                {orgs.map((org) => (
                  <SelectGroup key={org.id}>
                    <SelectLabel className="text-xs tracking-widest uppercase">
                      {org.name}
                    </SelectLabel>
                    {campaignsInOrg(org.id).map((item) => (
                      <SelectItem key={item.id} value={item.id} className="min-h-11">
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          )}
        </span>
      </div>
    </div>
  );
}

function MoreGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-2 border-b py-3 last:border-b-0"
    >
      <p className="text-muted-foreground text-xs tracking-widest uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

// Phone bottom bar: the tabs of where you are, plus More (Setup when in the
// militia, organization, account).
function BottomBar({
  tabs,
  extra,
  section,
  campaignId,
  orgId,
  setOrgId,
  go,
}: {
  tabs: Tab[];
  /** Tabs that do not fit the bar and live in More instead. */
  extra: Tab[];
  section: Page;
  campaignId: string | undefined;
  orgId: string;
  setOrgId: (id: string) => void;
  go: ShellProps['go'];
}) {
  const [open, setOpen] = useState(false);
  const cols = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'];
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav aria-label="Sections" className={cn('grid', cols[tabs.length + 1])}>
        {tabs.map((tab) => {
          const active = tabActive(tab, section);
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.page}
              type="button"
              onClick={() => go({ page: tab.page, campaignId })}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                active
                  ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TabIcon className="size-5" aria-hidden />
              <span aria-hidden>{tab.short}</span>
            </button>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(
              'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
              extra.some((tab) => tab.page === section)
                ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            More
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader>
              <SheetTitle>More</SheetTitle>
              <SheetDescription>
                {extra.length > 0
                  ? 'Setup, organization and account.'
                  : 'Organization and account.'}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col px-4 pb-4">
              {extra.length > 0 && (
                <MoreGroup label="Militia">
                  {extra.map((tab) => {
                    const TabIcon = tab.icon;
                    const active = tab.page === section;
                    return (
                      <button
                        key={tab.page}
                        type="button"
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          setOpen(false);
                          go({ page: tab.page, campaignId });
                        }}
                        className={cn(
                          'focus-visible:ring-ring/50 flex min-h-11 items-center gap-3 rounded-md px-2 text-sm outline-none focus-visible:ring-[3px]',
                          active ? 'bg-foreground/10' : 'hover:bg-foreground/5',
                        )}
                      >
                        <TabIcon className="size-5" aria-hidden /> {tab.label}
                      </button>
                    );
                  })}
                </MoreGroup>
              )}
              <MoreGroup label="Organization">
                <MockOrgSwitcher
                  value={orgId}
                  onChange={(id) => {
                    setOpen(false);
                    setOrgId(id);
                  }}
                  fill
                />
              </MoreGroup>
              <MoreGroup label="Account">
                <div className="flex items-center gap-3 px-1">
                  <MockAvatar />
                  <span className="text-sm">Andreas</span>
                  <Button type="button" variant="outline" size="sm" className="ml-auto min-h-11">
                    Sign out
                  </Button>
                </div>
              </MoreGroup>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}

export function VariantC({
  location,
  go,
  orgId,
  setOrgId,
  content,
}: ShellProps) {
  useMockStore();
  const campaign = getCampaign(campaignOf(location));
  const sheet = location.page === 'sheet';
  const militia = !sheet && isMilitiaPage(location.page) && campaign?.militia;
  const section = sectionOf(location, campaign !== undefined);

  const sectionTabs = campaign ? campaignTabs(campaign) : TOP_TABS;
  const phoneTabs = militia && campaign ? militiaTabs(campaign) : sectionTabs;
  const phoneExtra = militia ? [SETUP] : [];

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
        // Militia pages bound the frame so the rail fills the height and
        // Setup sits at its bottom while the content scrolls beside it.
        militia && 'md:h-dvh md:overflow-clip',
      )}
    >
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 items-center gap-x-2 border-b px-3 py-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] md:gap-x-3 md:px-4 md:py-2">
        <KeepIcon className="text-primary hidden size-8 shrink-0 md:block" />
        <span className="text-muted-foreground hidden md:inline" aria-hidden>
          /
        </span>
        <PlacePicker
          location={location}
          campaign={campaign}
          orgId={orgId}
          go={go}
          className="w-full max-w-none flex-1 md:w-fit md:max-w-[11rem] md:flex-none xl:max-w-[16rem]"
        />
        <nav
          aria-label="Sections"
          className="hidden min-w-0 shrink-0 items-center gap-1 md:flex"
        >
          {sectionTabs.map((tab) => (
            <NavLink
              key={tab.page}
              active={tabActive(tab, section)}
              onClick={() => go({ page: tab.page, campaignId: campaign?.id })}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          <span className="hidden md:inline-flex">
            <MockOrgSwitcher value={orgId} onChange={setOrgId} />
          </span>
          <MockAvatar />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {militia && campaign && (
          <MilitiaRail campaign={campaign} section={section} go={go} />
        )}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            militia && 'md:overflow-y-auto',
          )}
        >
          {sheet && <SheetSubHeader location={location} go={go} />}
          {content}
        </div>
      </div>

      <BottomBar
        tabs={phoneTabs}
        extra={phoneExtra}
        section={section}
        campaignId={campaign?.id}
        orgId={orgId}
        setOrgId={setOrgId}
        go={go}
      />
    </div>
  );
}
