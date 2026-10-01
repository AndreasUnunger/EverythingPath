'use client';
// PROTOTYPE variant A — "Stacked bars": every navigation level is its own
// horizontal bar. Desktop/tablet: one top bar with the areas, then (inside a
// campaign) a `/`, the campaign switcher and the campaign pages; on militia
// pages a second lighter bar with the militia sections. Phone: compact top
// bar (Keep + level title with a back chevron) and a bottom bar with the
// innermost level's tabs; everything outer lives in the More sheet.
import {
  ChevronLeft,
  Flag,
  History,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { KeepIcon } from '~/components/keepIcon';
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
  campaignOf,
  isMilitiaPage,
  type Location,
  type Page,
  type ShellProps,
} from './types';

const ALL_CAMPAIGNS = '__all';

type Tab = {
  page: Page;
  label: string;
  short: string;
  icon: typeof Home;
  active: boolean;
  to: Location;
};

type Level = 'top' | 'campaign' | 'militia';

const FROM_LABEL: Partial<Record<Page, string>> = {
  characters: 'Characters',
  'campaign-home': 'Home',
  'campaign-characters': 'Characters',
  officers: 'Characters & officers',
  week: 'Week',
  history: 'Finished weeks',
  militia: 'Militia',
  setup: 'Setup',
};

// Where the location sits, read once and shared by every bar.
function useModel(location: Location, orgId: string) {
  useMockStore();
  const campaign = getCampaign(campaignOf(location));
  const sheet = location.page === 'sheet';
  const militia = isMilitiaPage(location.page) && campaign?.militia != null;
  const level: Level = militia ? 'militia' : campaign ? 'campaign' : 'top';

  const areas: Tab[] = [
    {
      page: 'campaigns',
      label: 'Campaigns',
      short: 'Campaigns',
      icon: Flag,
      active: location.page === 'campaigns' || campaign !== undefined,
      to: { page: 'campaigns' },
    },
    {
      page: 'characters',
      label: 'Characters',
      short: 'Characters',
      icon: Users,
      active: location.page === 'characters' || (sheet && !campaign),
      to: { page: 'characters' },
    },
  ];

  const campaignPages: Tab[] = campaign
    ? [
        {
          page: 'campaign-home',
          label: 'Home',
          short: 'Home',
          icon: Home,
          active: location.page === 'campaign-home',
          to: { page: 'campaign-home', campaignId: campaign.id },
        },
        {
          page: 'campaign-characters',
          label: 'Characters',
          short: 'Characters',
          icon: Users,
          active: location.page === 'campaign-characters' || sheet,
          to: { page: 'campaign-characters', campaignId: campaign.id },
        },
        ...(campaign.militia
          ? [
              {
                page: 'militia' as const,
                label: 'Militia',
                short: 'Militia',
                icon: Shield,
                active: isMilitiaPage(location.page),
                to: { page: 'week' as const, campaignId: campaign.id },
              },
            ]
          : []),
      ]
    : [];

  const militiaPages: Tab[] =
    campaign?.militia && militia
      ? [
          {
            page: 'week',
            label: `Week ${campaign.militia.week}`,
            short: 'Week',
            icon: LayoutGrid,
            active: location.page === 'week',
            to: { page: 'week', campaignId: campaign.id },
          },
          {
            page: 'history',
            label: 'Finished weeks',
            short: 'Finished',
            icon: History,
            active: location.page === 'history',
            to: { page: 'history', campaignId: campaign.id },
          },
          {
            page: 'militia',
            label: 'Militia',
            short: 'Militia',
            icon: Shield,
            active: location.page === 'militia',
            to: { page: 'militia', campaignId: campaign.id },
          },
          {
            page: 'officers',
            label: 'Characters & officers',
            short: 'Characters',
            icon: Users,
            active: location.page === 'officers',
            to: { page: 'officers', campaignId: campaign.id },
          },
        ]
      : [];
  const setup: Tab | undefined =
    campaign && militia
      ? {
          page: 'setup',
          label: 'Setup',
          short: 'Setup',
          icon: Settings,
          active: location.page === 'setup',
          to: { page: 'setup', campaignId: campaign.id },
        }
      : undefined;

  // The campaign switcher lists the active organization's campaigns; a sheet
  // reached from another organization still shows its own campaign.
  const switchable = campaignsInOrg(orgId);
  const campaignOptions =
    campaign && !switchable.includes(campaign)
      ? [campaign, ...switchable]
      : switchable;

  return {
    campaign,
    sheet,
    level,
    areas,
    campaignPages,
    militiaPages,
    setup,
    campaignOptions,
  };
}

type Model = ReturnType<typeof useModel>;

export function VariantA(props: ShellProps) {
  const { location, go, orgId, setOrgId, content } = props;
  const model = useModel(location, orgId);
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]">
        <WideTopBar
          model={model}
          go={go}
          orgId={orgId}
          setOrgId={setOrgId}
        />
        <PhoneTopBar model={model} go={go} />
      </header>
      {model.militiaPages.length > 0 && (
        <MilitiaBar model={model} go={go} />
      )}
      {model.sheet && <SheetBackLink location={location} go={go} />}
      <div className="flex min-h-0 flex-1 flex-col">{content}</div>
      <BottomBar model={model} go={go} orgId={orgId} setOrgId={setOrgId} />
    </div>
  );
}

// Desktop/tablet (md and up): one row. Areas first, then the campaign
// context after a `/`, then the account controls at the right end.
function WideTopBar({
  model,
  go,
  orgId,
  setOrgId,
}: {
  model: Model;
  go: ShellProps['go'];
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  return (
    <div className="hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 md:flex md:gap-x-3">
      <KeepButton onClick={() => go({ page: 'campaigns' })} />
      <nav aria-label="Areas" className="flex shrink-0 items-center gap-1">
        {model.areas.map((tab) => (
          <NavLink key={tab.page} active={tab.active} onClick={() => go(tab.to)}>
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {model.campaign && (
        <>
          <span className="text-muted-foreground" aria-hidden>
            /
          </span>
          <CampaignSwitcher
            campaign={model.campaign}
            campaigns={model.campaignOptions}
            go={go}
          />
          <nav
            aria-label="Campaign pages"
            className="flex shrink-0 items-center gap-1"
          >
            {model.campaignPages.map((tab) => (
              <NavLink
                key={tab.page}
                active={tab.active}
                onClick={() => go(tab.to)}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <MockOrgSwitcher value={orgId} onChange={setOrgId} />
        <MockAvatar />
      </div>
    </div>
  );
}

// Phone: Keep icon plus the current level's title. The chevron climbs one
// level: Militia → campaign Home → Campaigns.
function PhoneTopBar({ model, go }: { model: Model; go: ShellProps['go'] }) {
  const { campaign, level } = model;
  const up: Location | undefined =
    level === 'militia' && campaign
      ? { page: 'campaign-home', campaignId: campaign.id }
      : level === 'campaign'
        ? { page: 'campaigns' }
        : undefined;
  const title =
    level === 'militia'
      ? 'Militia'
      : level === 'campaign' && campaign
        ? campaign.name
        : model.areas.find((tab) => tab.active)?.label;
  const subtitle = level === 'militia' ? campaign?.name : undefined;
  return (
    <div className="flex min-h-12 items-center gap-1 px-2 md:hidden">
      <KeepButton
        className="ml-1 shrink-0"
        onClick={() => go({ page: 'campaigns' })}
      />
      {up && (
        <button
          type="button"
          aria-label="Up one level"
          onClick={() => go(up)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex size-9 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      )}
      <div className={cn('flex min-w-0 flex-col leading-tight', !up && 'ml-1')}>
        {subtitle && (
          <span className="text-muted-foreground truncate text-[11px]">
            {subtitle}
          </span>
        )}
        <span className="truncate text-base font-medium">{title}</span>
      </div>
    </div>
  );
}

// Second bar on militia pages, a shade lighter than the top bar; Setup at
// the right end.
function MilitiaBar({ model, go }: { model: Model; go: ShellProps['go'] }) {
  return (
    <nav
      aria-label="Militia sections"
      className="bg-sidebar-accent/60 text-sidebar-foreground border-sidebar-border hidden shrink-0 items-center gap-1 border-b px-4 py-1.5 md:flex"
    >
      {model.militiaPages.map((tab) => (
        <NavLink key={tab.page} active={tab.active} onClick={() => go(tab.to)}>
          {tab.label}
        </NavLink>
      ))}
      {model.setup && (
        <NavLink
          active={model.setup.active}
          onClick={() => go(model.setup!.to)}
          className="ml-auto inline-flex items-center gap-1.5"
        >
          <Settings className="size-4" aria-hidden />
          Setup
        </NavLink>
      )}
    </nav>
  );
}

function SheetBackLink({
  location,
  go,
}: {
  location: Location;
  go: ShellProps['go'];
}) {
  const character = getCharacter(location.characterId);
  const campaignId = character?.campaignId;
  const from: Page =
    location.from ?? (campaignId ? 'campaign-characters' : 'characters');
  const to: Location =
    from === 'characters' || from === 'campaigns'
      ? { page: from }
      : { page: from, campaignId };
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:px-6">
      <button
        type="button"
        onClick={() => go(to)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ml-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-[3px]"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {FROM_LABEL[from] ?? 'Back'}
      </button>
    </div>
  );
}

function CampaignSwitcher({
  campaign,
  campaigns,
  go,
  fill = false,
}: {
  campaign: Campaign;
  campaigns: Campaign[];
  go: ShellProps['go'];
  fill?: boolean;
}) {
  return (
    <Select
      value={campaign.id}
      onValueChange={(value) =>
        go(
          value === ALL_CAMPAIGNS
            ? { page: 'campaigns' }
            : { page: 'campaign-home', campaignId: value },
        )
      }
    >
      <SelectTrigger
        aria-label="Active campaign"
        title={campaign.name}
        className={cn(
          'min-h-9 min-w-0 border-0 bg-transparent px-1 text-sm shadow-none *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate md:text-base dark:bg-transparent',
          fill ? 'w-full flex-1' : 'max-w-[11rem] xl:max-w-[16rem]',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map((item) => (
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

function KeepButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Keep: all campaigns"
      onClick={onClick}
      className={cn(
        'text-primary hover:text-primary/80 focus-visible:ring-ring/50 shrink-0 rounded-sm outline-none focus-visible:ring-[3px]',
        className,
      )}
    >
      <KeepIcon className="size-8" />
    </button>
  );
}

// Phone bottom bar: the innermost level's tabs plus More.
function BottomBar({
  model,
  go,
  orgId,
  setOrgId,
}: {
  model: Model;
  go: ShellProps['go'];
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const tabs =
    model.level === 'militia'
      ? model.militiaPages
      : model.level === 'campaign'
        ? model.campaignPages
        : model.areas;
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav
        aria-label="Sections"
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, 1fr)` }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.page}
              type="button"
              aria-label={tab.label}
              aria-current={tab.active ? 'page' : undefined}
              onClick={() => go(tab.to)}
              className={cn(
                'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                tab.active
                  ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span aria-hidden>{tab.short}</span>
            </button>
          );
        })}
        <MoreSheet model={model} go={go} orgId={orgId} setOrgId={setOrgId} />
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
      className="flex flex-col gap-1 border-b py-3 last:border-b-0"
    >
      <p className="text-muted-foreground mb-1 text-xs tracking-widest uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function MoreRow({ tab, onClick }: { tab: Tab; onClick: () => void }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={tab.active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 flex min-h-11 items-center gap-3 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-[3px]',
        tab.active
          ? 'bg-primary/10 text-primary'
          : 'hover:bg-foreground/10 text-foreground',
      )}
    >
      <Icon className="size-5" aria-hidden />
      {tab.label}
    </button>
  );
}

// Holds every level outside the bottom bar: Setup (in militia), the campaign
// pages (in militia), the campaign switcher and the areas (in a campaign),
// then organization and account. Navigating closes the sheet.
function MoreSheet({
  model,
  go,
  orgId,
  setOrgId,
}: {
  model: Model;
  go: ShellProps['go'];
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = (to: Location) => {
    setOpen(false);
    go(to);
  };
  const { campaign, level } = model;
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset">
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
            {level === 'top'
              ? 'Organization and account.'
              : 'Outer levels, organization and account.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col px-4 pb-4">
          {level === 'militia' && model.setup && (
            <MoreGroup label="Militia">
              <MoreRow
                tab={model.setup}
                onClick={() => navigate(model.setup!.to)}
              />
            </MoreGroup>
          )}
          {level === 'militia' && campaign && (
            <MoreGroup label={campaign.name}>
              {model.campaignPages.map((tab) => (
                <MoreRow
                  key={tab.page}
                  tab={tab}
                  onClick={() => navigate(tab.to)}
                />
              ))}
            </MoreGroup>
          )}
          {campaign && (
            <MoreGroup label="Campaign">
              <CampaignSwitcher
                campaign={campaign}
                campaigns={model.campaignOptions}
                go={navigate}
                fill
              />
            </MoreGroup>
          )}
          {level !== 'top' && (
            <MoreGroup label="Areas">
              {model.areas.map((tab) => (
                <MoreRow
                  key={tab.page}
                  tab={tab}
                  onClick={() => navigate(tab.to)}
                />
              ))}
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
            <div className="flex items-center gap-3 px-2 py-1 text-sm">
              <MockAvatar />
              Andreas
            </div>
          </MoreGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
