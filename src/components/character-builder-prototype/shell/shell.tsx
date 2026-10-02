'use client';
// PROTOTYPE (throwaway, #208) — the approved app shell, variant C of #213
// ("Militia rail", tag `prototype-approved/app-shell`,
// `app-shell-prototype/variant-c-shell.tsx`), wired to this prototype's
// store and URL. From tablet width: one pinned top bar (the campaign as a
// crumb with a place picker, the place's pages as section links, org
// switcher, avatar) and a left rail for the militia's second level, icons
// only below 1280px. On phone: fixed bottom tabs Campaign · Militia ·
// Characters · More, and the current tab's pages in a strip pinned under
// the top bar. A Character page (sheet, levelup, create, buildout) opens
// with no bar of its own, only Back to where it came from; its name,
// status and membership actions are in the page body, once.
//
// `--shell-top` on the root is the pinned top bar's height, so a page's own
// sticky element can sit under it (`top: var(--shell-top)`).
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
import { ORGS } from '../mock-characters';
import { isCharacterPage, isMilitiaPage, useProtoNav } from '../nav';
import { useCampaigns } from '../store';
import type { Campaign, ProtoPage } from '../types';
import {
  campaignTabs,
  militiaTabs,
  PAGE_LABEL,
  phoneAreaOf,
  sectionOf,
  TOP_TABS,
  type Tab,
} from './model';
import { MockAvatar, MockOrgSwitcher, NavLink } from './parts';
import { PhoneTabsBar, PhoneTabsStrip, type PhoneProps } from './phone';

type Go = (page: ProtoPage, campaignId?: string) => void;

/** Does the campaign-level link for `tab` light up for the current section? */
function tabActive(tab: Tab, section: ProtoPage) {
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
  page,
  campaign,
  go,
  className,
}: {
  page: ProtoPage;
  campaign: Campaign | undefined;
  go: Go;
  className?: string;
}) {
  const campaigns = useCampaigns();
  const value =
    campaign?.id ??
    (page === 'characters' || (isCharacterPage(page) && !campaign)
      ? 'characters'
      : 'campaigns');
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next === 'campaigns') go('campaigns');
        else if (next === 'characters') go('characters');
        else go('campaign-home', next);
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
            {ORGS[0]!.name}
          </SelectLabel>
          {campaigns.map((item) => (
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
  section: ProtoPage;
  go: Go;
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
        onClick={() => go(tab.page, campaign.id)}
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
      {/* pb clears the prototype's switcher and state panel. */}
      <div className="mt-auto flex flex-col gap-1 pb-24">
        <hr className="border-sidebar-border my-1" />
        {item(setup)}
      </div>
    </aside>
  );
}

// A Character page's opening: no bar, just Back to where you came from at
// the top of the content, aligned with the body.
function SheetBack() {
  const nav = useProtoNav();
  const label = PAGE_LABEL[nav.back.page];
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-3 md:px-6 md:pt-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 min-h-9 px-2"
        onClick={nav.goBack}
        aria-label={`Back to ${label}`}
      >
        <ArrowLeft /> {label}
      </Button>
    </div>
  );
}

/**
 * The last campaign visited this session, so the phone Campaign tab keeps
 * pointing at "your campaign" while you browse the Characters area.
 */
function useRecentCampaign(campaign: Campaign | undefined) {
  const [recent, setRecent] = useState<Campaign | undefined>(campaign);
  useEffect(() => {
    if (campaign) setRecent(campaign);
  }, [campaign]);
  return campaign ?? recent;
}

/** The pinned top bar's height as `--shell-top`. */
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

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useProtoNav();
  const { page, campaign } = nav;
  const context = useRecentCampaign(campaign);
  const characterPage = isCharacterPage(page);
  const militia = !characterPage && isMilitiaPage(page) && campaign?.militia;
  const section = sectionOf(page, nav.origin.page, campaign !== undefined);
  const area = phoneAreaOf(page, nav.origin.page);
  const sectionTabs = campaign ? campaignTabs(campaign) : TOP_TABS;
  const go: Go = (to, campaignId) =>
    nav.go(to, { campaign: campaignId ?? null });
  const phoneProps: PhoneProps = {
    page,
    section,
    area,
    campaign,
    context,
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
      <header
        ref={shellTop.ref}
        className="bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 shrink-0 border-b pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center gap-x-2 px-3 py-1.5 md:gap-x-3 md:px-4 md:py-2">
          {/* Phone: the place as a title. */}
          <PlacePicker
            page={page}
            campaign={campaign}
            go={go}
            className="w-full max-w-none flex-1 md:hidden"
          />
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
                page={page}
                campaign={campaign}
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
                onClick={() => go(tab.page, campaign?.id)}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
            <span className="hidden md:inline-flex">
              <MockOrgSwitcher />
            </span>
            <MockAvatar />
          </div>
        </div>
        <PhoneTabsStrip {...phoneProps} />
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
          {characterPage && <SheetBack />}
          {children}
        </div>
      </div>

      <PhoneTabsBar {...phoneProps} />
    </div>
  );
}
