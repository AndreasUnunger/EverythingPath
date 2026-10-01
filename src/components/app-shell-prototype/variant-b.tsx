'use client';
// PROTOTYPE variant B — "Campaign as a place". Entering a campaign swaps the
// top-level bar (Keep · [Campaigns | Characters] · org · account) for that
// campaign's own bar (← · name ⌄ · Home · Characters · Militia). Militia
// gets an underlined tab strip under the top bar. Sheets always live in the
// Characters area with a link chip back into their campaign.
import {
  ArrowLeft,
  ChevronRight,
  Home,
  LayoutGrid,
  LogOut,
  MoreHorizontal,
  Settings,
  Shield,
  Swords,
  UserRound,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { KeepIcon } from '~/components/keepIcon';
import { Button } from '~/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import {
  campaignsInOrg,
  getCampaign,
  getCharacter,
  useMockStore,
  type Campaign,
} from './mock';
import { MockAvatar, MockOrgSwitcher, NavLink } from './parts';
import {
  isCampaignPage,
  isMilitiaPage,
  type Location,
  type Page,
  type ShellProps,
} from './types';

const ALL_CAMPAIGNS = '__all';
const focusRing =
  'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]';

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
  sheet: 'Character',
};

type Go = (to: Location) => void;

function militiaTabs(campaign: Campaign) {
  const week = campaign.militia?.week ?? 0;
  return [
    { page: 'week' as const, label: `Week ${week}`, short: `Week ${week}` },
    { page: 'history' as const, label: 'Finished weeks', short: 'Finished' },
    { page: 'militia' as const, label: 'Militia', short: 'Militia' },
    {
      page: 'officers' as const,
      label: 'Characters & officers',
      short: 'Characters & officers',
    },
  ];
}

export function VariantB({
  location,
  go,
  orgId,
  setOrgId,
  content,
}: ShellProps) {
  useMockStore();
  // The sheet is never "inside" a campaign here: it belongs to the
  // Characters area, whatever campaign the character is in.
  const campaign = isCampaignPage(location.page)
    ? getCampaign(location.campaignId)
    : undefined;
  const militia = !!campaign?.militia && isMilitiaPage(location.page);
  const area: 'campaigns' | 'characters' =
    location.page === 'characters' || location.page === 'sheet'
      ? 'characters'
      : 'campaigns';

  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border z-40 flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)] max-md:sticky max-md:top-0">
        {campaign ? (
          <CampaignTopBar
            campaign={campaign}
            location={location}
            go={go}
            orgId={orgId}
            setOrgId={setOrgId}
          />
        ) : (
          <TopLevelBar area={area} go={go} orgId={orgId} setOrgId={setOrgId} />
        )}
        {militia && (
          <MilitiaStrip campaign={campaign} location={location} go={go} />
        )}
      </header>
      {location.page === 'sheet' && (
        <SheetContext location={location} go={go} />
      )}
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
      <BottomBar
        campaign={campaign}
        area={area}
        location={location}
        go={go}
        orgId={orgId}
        setOrgId={setOrgId}
      />
    </div>
  );
}

// Top level: Keep · [Campaigns | Characters] · org · account

function TopLevelBar({
  area,
  go,
  orgId,
  setOrgId,
}: {
  area: 'campaigns' | 'characters';
  go: Go;
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-x-3 px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2">
      <KeepButton onClick={() => go({ page: 'campaigns' })} />
      <Segmented area={area} go={go} />
      <div className="ml-auto flex min-w-0 items-center gap-2 md:gap-3">
        <span className="hidden md:inline-flex">
          <MockOrgSwitcher value={orgId} onChange={setOrgId} />
        </span>
        <AccountMenu go={go} />
      </div>
    </div>
  );
}

function KeepButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Keep: all campaigns"
      onClick={onClick}
      className={cn(
        'text-primary hover:text-primary/80 shrink-0 rounded-sm',
        focusRing,
      )}
    >
      <KeepIcon className="size-8" />
    </button>
  );
}

function Segmented({ area, go }: { area: 'campaigns' | 'characters'; go: Go }) {
  const segment = (key: 'campaigns' | 'characters', label: string) => {
    const active = area === key;
    return (
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => go({ page: key })}
        className={cn(
          'min-h-8 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors md:px-4',
          focusRing,
          active
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
      </button>
    );
  };
  return (
    <nav
      aria-label="Areas"
      className="bg-foreground/10 flex shrink-0 items-center rounded-full p-0.5"
    >
      {segment('campaigns', 'Campaigns')}
      {segment('characters', 'Characters')}
    </nav>
  );
}

// Account menu: My characters moved in here once a campaign bar has taken
// over the top bar; at top level it still offers the same entries.
function AccountMenu({ go }: { go: Go }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = (icon: ReactNode, label: string, onClick?: () => void) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => {
        setOpen(false);
        onClick?.();
      }}
      className={cn(
        'hover:bg-foreground/10 flex min-h-10 w-full items-center gap-2.5 px-3 text-left text-sm',
        focusRing,
        'focus-visible:ring-inset',
      )}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={root} className="relative hidden shrink-0 md:block">
      <MockAvatar
        onClick={() => setOpen((v) => !v)}
        className={cn(open && 'ring-ring/50 ring-[3px]')}
      />
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="bg-popover text-popover-foreground border-foreground/15 absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border py-1 shadow-md"
        >
          <p className="text-muted-foreground px-3 pt-1.5 pb-1 text-xs">
            Andreas · signed in
          </p>
          {item(
            <UserRound className="size-4" aria-hidden />,
            'My characters',
            () => go({ page: 'characters' }),
          )}
          <div className="border-foreground/15 my-1 border-t" />
          {item(
            <Settings className="size-4" aria-hidden />,
            'Account settings',
          )}
          {item(<LogOut className="size-4" aria-hidden />, 'Sign out')}
        </div>
      )}
    </div>
  );
}

// Inside a campaign: ← · Kingmaker ⌄ · Home · Characters · Militia · org · account

function CampaignTopBar({
  campaign,
  location,
  go,
  orgId,
  setOrgId,
}: {
  campaign: Campaign;
  location: Location;
  go: Go;
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const inMilitia = isMilitiaPage(location.page);
  return (
    <div className="flex min-w-0 items-center gap-x-2 px-2 py-1.5 md:gap-x-3 md:px-3 md:py-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Back to Campaigns"
            onClick={() => go({ page: 'campaigns' })}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-foreground/10 flex size-9 shrink-0 items-center justify-center rounded-md',
              focusRing,
            )}
          >
            <ArrowLeft className="size-5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Campaigns</TooltipContent>
      </Tooltip>
      <CampaignHeading campaign={campaign} go={go} orgId={orgId} />

      <nav
        aria-label="Campaign pages"
        className="ml-auto hidden shrink-0 items-center gap-1 md:flex"
      >
        <NavLink
          active={location.page === 'campaign-home'}
          onClick={() => go({ page: 'campaign-home', campaignId: campaign.id })}
        >
          Home
        </NavLink>
        <NavLink
          active={location.page === 'campaign-characters'}
          onClick={() =>
            go({ page: 'campaign-characters', campaignId: campaign.id })
          }
        >
          Characters
        </NavLink>
        {campaign.militia && (
          <NavLink
            active={inMilitia}
            onClick={() => go({ page: 'week', campaignId: campaign.id })}
          >
            Militia
          </NavLink>
        )}
      </nav>

      <div className="hidden min-w-0 shrink-0 items-center gap-3 md:ml-2 md:flex lg:ml-4">
        <MockOrgSwitcher value={orgId} onChange={setOrgId} />
        <AccountMenu go={go} />
      </div>
    </div>
  );
}

// The campaign name set as the bar's heading; the chevron opens the switcher.
function CampaignHeading({
  campaign,
  go,
  orgId,
}: {
  campaign: Campaign;
  go: Go;
  orgId: string;
}) {
  const siblings = campaignsInOrg(orgId);
  return (
    <Select
      value={campaign.id}
      onValueChange={(value) =>
        value === ALL_CAMPAIGNS
          ? go({ page: 'campaigns' })
          : go({ page: 'campaign-home', campaignId: value })
      }
    >
      <SelectTrigger
        aria-label="Active campaign"
        title={campaign.name}
        className="min-h-9 max-w-[calc(100%-3rem)] min-w-0 border-0 bg-transparent px-1.5 py-1 text-lg font-semibold tracking-tight shadow-none data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate md:max-w-[22rem] md:flex-none md:text-xl dark:bg-transparent [&_svg]:size-4"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {siblings.map((item) => (
          <SelectItem key={item.id} value={item.id} className="min-h-11">
            {item.name}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={ALL_CAMPAIGNS} className="min-h-11">
          All campaigns…
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

// Militia's second level: an underlined tab strip under the top bar from
// tablet width; a horizontally scrolling chip strip on phone.
function MilitiaStrip({
  campaign,
  location,
  go,
}: {
  campaign: Campaign;
  location: Location;
  go: Go;
}) {
  const tabs = militiaTabs(campaign);
  const setupActive = location.page === 'setup';
  const to = (page: Page) => () => go({ page, campaignId: campaign.id });
  return (
    <>
      <nav
        aria-label="Militia sections"
        className="border-sidebar-border -mt-px hidden items-end gap-1 border-t px-3 md:flex"
      >
        {tabs.map((tab) => {
          const active = location.page === tab.page;
          return (
            <button
              key={tab.page}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={to(tab.page)}
              className={cn(
                '-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap',
                focusRing,
                'focus-visible:ring-inset',
                active
                  ? 'border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:border-foreground/30 border-transparent',
              )}
            >
              {tab.label}
            </button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-current={setupActive ? 'page' : undefined}
          onClick={to('setup')}
          className={cn(
            'my-1.5 ml-auto h-7 px-2.5 text-xs',
            setupActive && 'bg-background text-foreground border-primary',
          )}
        >
          <Settings aria-hidden /> Setup
        </Button>
      </nav>

      <nav
        aria-label="Militia sections"
        className="border-sidebar-border flex gap-1.5 overflow-x-auto border-t px-3 py-2 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
      >
        {[
          ...tabs,
          { page: 'setup' as const, short: 'Setup', label: 'Setup' },
        ].map((tab) => {
          const active = location.page === tab.page;
          return (
            <button
              key={tab.page}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={to(tab.page)}
              className={cn(
                'min-h-8 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap',
                focusRing,
                tab.page === 'setup' && 'ml-auto',
                active
                  ? 'bg-background text-foreground border-primary'
                  : 'border-foreground/20 text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.short}
            </button>
          );
        })}
      </nav>
    </>
  );
}

// Sheet: a strip above the sheet with the way back and the campaign chip.
function SheetContext({ location, go }: { location: Location; go: Go }) {
  const character = getCharacter(location.characterId);
  const campaign = getCampaign(character?.campaignId);
  const from = location.from;
  const back = () => {
    if (!from) return go({ page: 'characters' });
    if (isCampaignPage(from) && campaign)
      return go({ page: from, campaignId: campaign.id });
    return go({ page: from === 'sheet' ? 'characters' : from });
  };
  const backLabel =
    from && from !== 'sheet' ? PAGE_LABEL[from] : 'My characters';
  return (
    <div className="border-foreground/15 bg-background/60 flex min-w-0 items-center gap-3 border-b px-3 py-1.5 text-sm md:px-6">
      <button
        type="button"
        onClick={back}
        className={cn(
          'text-muted-foreground hover:text-foreground -ml-1 flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 md:flex-none',
          focusRing,
        )}
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        <span className="truncate">
          {from && isCampaignPage(from) && campaign && (
            <span className="hidden md:inline">{campaign.name} · </span>
          )}
          {backLabel}
        </span>
      </button>
      {campaign ? (
        <button
          type="button"
          onClick={() => go({ page: 'campaign-home', campaignId: campaign.id })}
          className={cn(
            'bg-primary/15 text-primary hover:bg-primary/25 border-primary/40 ml-auto flex max-w-[60%] min-w-0 shrink-0 items-center gap-1.5 rounded-full border px-3 font-medium md:max-w-none',
            focusRing,
          )}
        >
          <Swords className="size-4 shrink-0" aria-hidden />
          <span className="truncate">In {campaign.name}</span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </button>
      ) : (
        <span className="text-muted-foreground ml-auto shrink-0 text-xs">
          Not in a campaign
        </span>
      )}
    </div>
  );
}

// Phone bottom bar: the campaign's pages inside a campaign, the areas at top
// level, More at the end either way.

type Tab = {
  key: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick: () => void;
};

function BottomBar({
  campaign,
  area,
  location,
  go,
  orgId,
  setOrgId,
}: {
  campaign: Campaign | undefined;
  area: 'campaigns' | 'characters';
  location: Location;
  go: Go;
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const tabs: Tab[] = campaign
    ? [
        {
          key: 'home',
          label: 'Home',
          icon: Home,
          active: location.page === 'campaign-home',
          onClick: () => go({ page: 'campaign-home', campaignId: campaign.id }),
        },
        {
          key: 'characters',
          label: 'Characters',
          icon: Users,
          active: location.page === 'campaign-characters',
          onClick: () =>
            go({ page: 'campaign-characters', campaignId: campaign.id }),
        },
        ...(campaign.militia
          ? [
              {
                key: 'militia',
                label: 'Militia',
                icon: Shield,
                active: isMilitiaPage(location.page),
                onClick: () => go({ page: 'week', campaignId: campaign.id }),
              },
            ]
          : []),
      ]
    : [
        {
          key: 'campaigns',
          label: 'Campaigns',
          icon: LayoutGrid,
          active: area === 'campaigns',
          onClick: () => go({ page: 'campaigns' }),
        },
        {
          key: 'characters',
          label: 'Characters',
          icon: UserRound,
          active: area === 'characters',
          onClick: () => go({ page: 'characters' }),
        },
      ];
  const columns = tabs.length + 1;
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav
        aria-label={campaign ? 'Campaign pages' : 'Areas'}
        className="grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              aria-current={tab.active ? 'page' : undefined}
              onClick={tab.onClick}
              className={cn(
                'relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]',
                focusRing,
                'focus-visible:ring-inset',
                tab.active
                  ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
        <MoreSheet
          key={`${location.page}-${orgId}`}
          campaign={campaign}
          go={go}
          orgId={orgId}
          setOrgId={setOrgId}
        />
      </nav>
    </div>
  );
}

function MoreGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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

function MoreSheet({
  campaign,
  go,
  orgId,
  setOrgId,
}: {
  campaign: Campaign | undefined;
  go: Go;
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useCallback(
    (to: Location) => {
      setOpen(false);
      go(to);
    },
    [go],
  );
  const row =
    'hover:bg-foreground/5 flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm ' +
    focusRing;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          'text-muted-foreground hover:text-foreground flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]',
          focusRing,
          'focus-visible:ring-inset',
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
            {campaign
              ? 'Switch campaign, your characters, organization and account.'
              : 'Your characters, organization and account.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col px-4 pb-4">
          {campaign && (
            <MoreGroup label="Campaign">
              <Select
                value={campaign.id}
                onValueChange={(value) =>
                  navigate(
                    value === ALL_CAMPAIGNS
                      ? { page: 'campaigns' }
                      : { page: 'campaign-home', campaignId: value },
                  )
                }
              >
                <SelectTrigger
                  aria-label="Active campaign"
                  className="min-h-11 w-full *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {campaignsInOrg(orgId).map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      className="min-h-11"
                    >
                      {item.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={ALL_CAMPAIGNS} className="min-h-11">
                    All campaigns…
                  </SelectItem>
                </SelectContent>
              </Select>
            </MoreGroup>
          )}
          <MoreGroup label="Characters">
            <button
              type="button"
              onClick={() => navigate({ page: 'characters' })}
              className={row}
            >
              <UserRound className="size-4" aria-hidden /> My characters
              <ChevronRight
                className="text-muted-foreground ml-auto size-4"
                aria-hidden
              />
            </button>
          </MoreGroup>
          <MoreGroup label="Organization">
            <MockOrgSwitcher
              value={orgId}
              onChange={(id) => {
                setOpen(false);
                setOrgId(id);
              }}
              fill
              className="min-h-11"
            />
          </MoreGroup>
          <MoreGroup label="Account">
            <div className="flex items-center gap-3 px-2 py-1">
              <MockAvatar />
              <span className="text-sm">Andreas</span>
            </div>
            <button type="button" className={row}>
              <Settings className="size-4" aria-hidden /> Account settings
            </button>
            <button type="button" className={row}>
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </MoreGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
