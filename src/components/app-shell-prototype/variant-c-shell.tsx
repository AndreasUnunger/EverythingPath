'use client';
// PROTOTYPE — the "Militia rail" shell shared by variants C and D. From
// tablet width both are the same: one calm top bar (the campaign as a crumb
// with a place picker, the place's pages as section links, org switcher,
// avatar) that stays pinned while the page scrolls, and a vertical rail for
// the militia's second level. On phone the two differ in `phone`:
//   'tabs'  (C) fixed bottom tabs Campaign · Militia · Characters · More, with
//           the pages of the current tab in a strip under the top bar (pinned
//           with it); a sheet opens with only a Back link above its body;
//   'drill' (D) minimal bottom bar Home · Characters · More, with an Up button
//           and a "Where to" navigator in the top bar; a sheet keeps its own
//           sticky sub-header.
import { ArrowLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import {
  campaignsInOrg,
  getCampaign,
  getCharacter,
  getOrg,
  levelLine,
  useMockStore,
  type Campaign,
} from './mock';
import { MockAvatar, MockOrgSwitcher, NavLink, StatusBadge } from './parts';
import {
  campaignOf,
  isMilitiaPage,
  type Location,
  type Page,
  type ShellProps,
} from './types';
import {
  campaignTabs,
  militiaTabs,
  PAGE_LABEL,
  sectionOf,
  sheetBack,
  TOP_TABS,
  type PhoneProps,
  type Tab,
} from './variant-c-parts';
import { PhoneTabsBar, PhoneTabsStrip } from './variant-c-phone';
import {
  PhoneDrillBar,
  PhoneDrillTitle,
  PhoneMilitiaHub,
} from './variant-d-phone';

export type PhonePattern = 'tabs' | 'drill';

/** Does the campaign-level link for `tab` light up for the current section? */
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
    (location.page === 'characters' || (location.page === 'sheet' && !campaign)
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
          Characters
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
  const tabs = militiaTabs(campaign);
  const setup = tabs[tabs.length - 1]!;

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
        {tabs.slice(0, -1).map((tab) => (
          <span key={tab.page}>
            {item(
              tab,
              tab.page === 'week' ? (
                <span className="bg-primary/15 text-primary rounded px-1 py-px font-mono text-[10px] tracking-wide uppercase">
                  current
                </span>
              ) : undefined,
            )}
          </span>
        ))}
      </nav>
      {/* pb clears the harness's dev badge (prototype only). */}
      <div className="mt-auto flex flex-col gap-1 pb-24">
        <hr className="border-sidebar-border my-1" />
        {item(setup)}
      </div>
    </aside>
  );
}

// Variant C's sheet opening: no bar, just Back to where you came from at the
// top of the sheet's content, aligned with its body. Name, status and the
// membership actions are already in the body.
function SheetBack({
  location,
  go,
}: {
  location: Location;
  go: ShellProps['go'];
}) {
  const back = sheetBack(location);
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:px-6 md:pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 min-h-9 px-2"
        onClick={() => go(back)}
        aria-label={`Back to ${PAGE_LABEL[back.page]}`}
      >
        <ArrowLeft /> {PAGE_LABEL[back.page]}
      </Button>
    </div>
  );
}

// Variant D's sheet sub-header: back to where you came from (from tablet
// width; D's phone top bar already carries Up), identity and status. Sticky
// under the top bar so Back stays at hand while the sheet scrolls. Actions
// (Build out, Leave or Add to campaign) live in the page body, once.
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
  const back = sheetBack(location);
  return (
    <div
      className="bg-background/95 border-foreground/15 sticky z-20 border-b backdrop-blur"
      style={{ top: 'var(--shell-top, 0px)' }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-x-3 px-4 py-2 md:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden min-h-9 shrink-0 px-2 md:inline-flex"
          onClick={() => go(back)}
          aria-label={`Back to ${PAGE_LABEL[back.page]}`}
        >
          <ArrowLeft />{' '}
          <span className="hidden sm:inline">{PAGE_LABEL[back.page]}</span>
        </Button>
        <span className="min-w-0 flex-1">
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
      </div>
    </div>
  );
}

/**
 * The last campaign visited this session. Lets a phone tab keep pointing at
 * "your campaign" while you browse the Characters area, so its target does
 * not change with every page.
 */
function useRecentCampaign(campaign: Campaign | undefined) {
  const [recent, setRecent] = useState<Campaign | undefined>(campaign);
  useEffect(() => {
    if (campaign) setRecent(campaign);
  }, [campaign]);
  return campaign ?? recent;
}

/**
 * The pinned top bar's height as `--shell-top`, so anything else that sticks
 * (D's sheet sub-header) can sit under it instead of sliding behind it. The
 * bar's height changes with the phone strip and with the viewport, hence a
 * ResizeObserver rather than a constant.
 */
function useShellTop() {
  const ref = useRef<HTMLElement>(null);
  const [top, setTop] = useState(0);
  useEffect(() => {
    const header = ref.current;
    if (!header) return;
    const measure = () => setTop(header.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return { ref, style: { '--shell-top': `${top}px` } as CSSProperties };
}

export function MilitiaRailShell({
  phone,
  location,
  go,
  orgId,
  setOrgId,
  content,
}: ShellProps & { phone: PhonePattern }) {
  useMockStore();
  const campaign = getCampaign(campaignOf(location));
  const context = useRecentCampaign(campaign);
  const sheet = location.page === 'sheet';
  const militia = !sheet && isMilitiaPage(location.page) && campaign?.militia;
  const section = sectionOf(location, campaign !== undefined);
  const sectionTabs = campaign ? campaignTabs(campaign) : TOP_TABS;
  const phoneProps: PhoneProps = {
    location,
    campaign,
    context,
    orgId,
    setOrgId,
    go,
  };
  const shellTop = useShellTop();

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]',
        // Militia pages bound the frame so the rail fills the height and
        // Setup sits at its bottom while the content scrolls beside it.
        militia && 'md:h-dvh md:overflow-clip',
      )}
      style={shellTop.style}
    >
      {/* Pinned: the page scrolls under it. Opaque (bg-sidebar), above page
          content (z-30; the phone bottom bar is z-40, dialogs and sheets
          z-50). The safe-area top inset is inside the bar so the bar's
          background covers it. */}
      <header
        ref={shellTop.ref}
        className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 shrink-0 border-b pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center gap-x-2 px-3 py-1.5 md:gap-x-3 md:px-4 md:py-2">
          {/* Phone: the place as a title (C: picker; D: Up + navigator). */}
          {phone === 'tabs' ? (
            <PlacePicker
              location={location}
              campaign={campaign}
              orgId={orgId}
              go={go}
              className="w-full max-w-none flex-1 md:hidden"
            />
          ) : (
            <PhoneDrillTitle {...phoneProps} />
          )}

          {/* Tablet and desktop: icon, the campaign as a crumb, its pages.
              At the top level the two area links are the whole picker. */}
          <KeepIcon className="text-primary hidden size-8 shrink-0 md:block" />
          {campaign && (
            <>
              <span
                className="text-muted-foreground hidden md:inline"
                aria-hidden
              >
                /
              </span>
              <PlacePicker
                location={location}
                campaign={campaign}
                orgId={orgId}
                go={go}
                className="hidden w-fit max-w-[11rem] md:flex xl:max-w-[16rem]"
              />
            </>
          )}
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
        </div>
        {phone === 'tabs' && <PhoneTabsStrip {...phoneProps} />}
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
          {sheet &&
            (phone === 'tabs' ? (
              <SheetBack location={location} go={go} />
            ) : (
              <SheetSubHeader location={location} go={go} />
            ))}
          {phone === 'drill' && location.page === 'militia' && campaign && (
            <PhoneMilitiaHub campaign={campaign} go={go} />
          )}
          {content}
        </div>
      </div>

      {phone === 'tabs' ? (
        <PhoneTabsBar {...phoneProps} />
      ) : (
        <PhoneDrillBar {...phoneProps} />
      )}
    </div>
  );
}
