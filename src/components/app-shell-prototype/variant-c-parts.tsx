'use client';
// PROTOTYPE — the "Militia rail" model and phone primitives shared by the
// shell (variant-c-shell.tsx) and its two phone patterns (variant-c-phone.tsx,
// variant-d-phone.tsx).
import {
  History,
  House,
  LayoutGrid,
  Map as MapIcon,
  MoreHorizontal,
  Settings,
  Shield,
  User,
  Users,
} from 'lucide-react';
import {
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react';
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
import { getCampaign, getCharacter, type Campaign } from './mock';
import { MockAvatar, MockOrgSwitcher } from './parts';
import {
  isCampaignPage,
  isMilitiaPage,
  type Location,
  type Page,
  type ShellProps,
} from './types';

export type Icon = ComponentType<SVGProps<SVGSVGElement>>;
export type Tab = { page: Page; label: string; icon: Icon };

export const TOP_TABS: Tab[] = [
  { page: 'campaigns', label: 'Campaigns', icon: MapIcon },
  { page: 'characters', label: 'Characters', icon: User },
];

/** Home · Characters (· Militia when the campaign has one). */
export function campaignTabs(campaign: Campaign): Tab[] {
  return [
    { page: 'campaign-home', label: 'Home', icon: House },
    { page: 'campaign-characters', label: 'Characters', icon: Users },
    ...(campaign.militia
      ? [{ page: 'militia' as Page, label: 'Militia', icon: Shield }]
      : []),
  ];
}

/** The militia's second level, Setup last. */
export function militiaTabs(campaign: Campaign): Tab[] {
  return [
    {
      page: 'week',
      label: `Week ${campaign.militia?.week ?? 0}`,
      icon: LayoutGrid,
    },
    { page: 'history', label: 'Finished weeks', icon: History },
    { page: 'militia', label: 'Militia', icon: Shield },
    { page: 'officers', label: 'Characters & officers', icon: Users },
    { page: 'setup', label: 'Setup', icon: Settings },
  ];
}

export const PAGE_LABEL: Record<Page, string> = {
  campaigns: 'Campaigns',
  characters: 'Characters',
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
 * The section the location belongs to, for highlighting the top-bar links: a
 * sheet borrows the page it was opened from (so Militia stays lit when you
 * came from the roster), otherwise the Characters page of its context.
 */
export function sectionOf(location: Location, inCampaign: boolean): Page {
  if (location.page !== 'sheet') return location.page;
  if (location.from && isCampaignPage(location.from) === inCampaign)
    return location.from;
  return inCampaign ? 'campaign-characters' : 'characters';
}

export type PhoneArea = 'campaign' | 'militia' | 'characters';

/**
 * Which phone tab a location belongs to. Unlike `sectionOf`, a sheet opened
 * from the Characters area keeps the Characters tab lit even when the
 * Character is in a campaign: the tab you came from is where Back goes.
 */
export function phoneAreaOf(
  location: Location,
  campaign: Campaign | undefined,
): PhoneArea {
  const page =
    location.page === 'sheet'
      ? (location.from ?? (campaign ? 'campaign-characters' : 'characters'))
      : location.page;
  if (page === 'characters') return 'characters';
  if (isMilitiaPage(page)) return 'militia';
  return 'campaign';
}

/** Where Back on a sheet goes: the page it was opened from, else its list. */
export function sheetBack(location: Location): Location {
  const character = getCharacter(location.characterId);
  const campaign = getCampaign(character?.campaignId);
  const from =
    location.from ?? (campaign ? 'campaign-characters' : 'characters');
  if (!isCampaignPage(from)) return { page: from };
  return campaign
    ? { page: from, campaignId: campaign.id }
    : { page: 'characters' };
}

/** Everything a phone bar needs to know about where you are. */
export type PhoneProps = {
  location: Location;
  /** The campaign of the location, if any. */
  campaign: Campaign | undefined;
  /** The campaign the bar acts for: the current one, else the last visited. */
  context: Campaign | undefined;
  orgId: string;
  setOrgId: (id: string) => void;
  go: ShellProps['go'];
};

export const phoneTabClass =
  'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset';
const phoneTabActiveClass =
  'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]';
export const phoneTabIdleClass = 'text-muted-foreground hover:text-foreground';

export function PhoneTab({
  icon: TabIcon,
  label,
  active,
  disabled = false,
  onClick,
}: {
  icon: Icon;
  label: string;
  active: boolean;
  /** Keeps the slot, dims it; onClick still fires so the tab can explain. */
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        phoneTabClass,
        active ? phoneTabActiveClass : phoneTabIdleClass,
        disabled && 'text-muted-foreground/40 hover:text-muted-foreground/40',
      )}
    >
      <TabIcon className="size-5" aria-hidden />
      <span aria-hidden>{label}</span>
    </button>
  );
}

/** The phone bottom bar frame: equal slots, hidden from tablet width. */
export function PhoneBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav aria-label="Sections" className="grid auto-cols-fr grid-flow-col">
        {children}
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

/** The More tab: organization and account, the same in every place. */
export function MoreTab({
  orgId,
  setOrgId,
}: {
  orgId: string;
  setOrgId: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={cn(phoneTabClass, phoneTabIdleClass)}>
        <MoreHorizontal className="size-5" aria-hidden />
        More
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Organization and account.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col px-4 pb-4">
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto min-h-11"
              >
                Sign out
              </Button>
            </div>
          </MoreGroup>
        </div>
      </SheetContent>
    </Sheet>
  );
}
