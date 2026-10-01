'use client';
// PROTOTYPE (throwaway, #208) — a fake campaign shell that looks like the
// current app shell (campaign-shell/shell-frame.tsx + campaign-shell.tsx):
// sidebar-coloured top bar with the Keep, campaign switcher and section
// links from 768px; a five-slot bottom bar below 768px. It renders no page
// chrome of its own: the variant owns everything inside the content column.

import {
  History,
  LayoutGrid,
  MoreHorizontal,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { KeepIcon } from '~/components/keepIcon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { cn } from '~/lib/utils';
import { useProtoNav } from './nav';
import { useBuilderStore } from './store';
import type { Campaign, ProtoPage } from './types';

export type FrameSection = {
  key: string;
  label: string;
  /** Bottom-bar label on phones. */
  short: string;
  icon: LucideIcon;
  /** Where clicking goes; absent = inert (sections outside this prototype). */
  to?: { page: ProtoPage; character?: string | null };
};

export type FrameNav = { sections: FrameSection[]; activeKey: string };

/** A variant may export one of these to change the section links (e.g. add a "Characters" section). */
export type FrameNavFn = (ctx: {
  campaign: Campaign;
  page: ProtoPage;
}) => FrameNav;

/** The real app's four sections; Characters & officers is where this prototype lives. */
export function defaultSections(campaign: Campaign): FrameSection[] {
  return [
    {
      key: 'week',
      label: campaign.militia ? `Week ${campaign.militia.week}` : 'Week',
      short: 'Week',
      icon: LayoutGrid,
    },
    {
      key: 'history',
      label: 'Finished weeks',
      short: 'Finished',
      icon: History,
    },
    { key: 'militia', label: 'Militia', short: 'Militia', icon: Shield },
    {
      key: 'characters',
      label: 'Characters & officers',
      short: 'Characters',
      icon: Users,
      to: { page: 'list' },
    },
  ];
}

export const defaultFrameNav: FrameNavFn = ({ campaign }) => ({
  sections: defaultSections(campaign),
  activeKey: 'characters',
});

function CampaignSwitcher({ campaign }: { campaign: Campaign }) {
  const { state } = useBuilderStore();
  const nav = useProtoNav();
  return (
    <Select
      value={campaign.id}
      onValueChange={(value) => nav.go('list', { campaign: value })}
    >
      <SelectTrigger
        aria-label="Active campaign"
        title={campaign.name}
        className="min-h-9 max-w-[11rem] min-w-0 border-0 bg-transparent px-1 text-sm shadow-none *:data-[slot=select-value]:block *:data-[slot=select-value]:truncate md:text-base xl:max-w-[16rem] dark:bg-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {state.campaigns.map((item) => (
          <SelectItem key={item.id} value={item.id} className="min-h-11">
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SectionLink({
  section,
  active,
  phone,
}: {
  section: FrameSection;
  active: boolean;
  phone?: boolean;
}) {
  const nav = useProtoNav();
  const Icon = section.icon;
  const go = section.to
    ? () => nav.go(section.to!.page, { character: section.to!.character })
    : undefined;
  if (phone)
    return (
      <button
        type="button"
        onClick={go}
        aria-label={section.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'focus-visible:ring-ring/50 relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
          active
            ? 'bg-primary/10 text-primary before:bg-primary before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[""]'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="size-5" aria-hidden />
        <span aria-hidden>{section.short}</span>
      </button>
    );
  return (
    <button
      type="button"
      onClick={go}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 short:py-0.5 rounded-md px-3 py-1.5 whitespace-nowrap outline-none focus-visible:ring-[3px]',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
      )}
    >
      {section.label}
    </button>
  );
}

export function PrototypeFrame({
  nav: navFn = defaultFrameNav,
  children,
}: {
  nav?: FrameNavFn;
  children: ReactNode;
}) {
  const { state } = useBuilderStore();
  const nav = useProtoNav();
  const campaign =
    state.campaigns.find((c) => c.id === nav.campaignId) ?? state.campaigns[0]!;
  const { sections, activeKey } = navFn({ campaign, page: nav.page });
  return (
    <div className="flex min-h-dvh flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <header className="bg-sidebar text-sidebar-foreground border-sidebar-border flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]">
        <div className="short:gap-y-0.5 short:py-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 md:gap-x-4 md:px-4 md:py-2">
          <span
            className="text-primary shrink-0"
            aria-label="Keep: all campaigns"
          >
            <KeepIcon className="size-8" />
          </span>
          <span className="text-muted-foreground hidden md:inline" aria-hidden>
            /
          </span>
          <CampaignSwitcher campaign={campaign} />
          <nav
            aria-label="Campaign sections"
            className="hidden shrink-0 items-center gap-1 text-sm md:flex"
          >
            {sections.map((section) => (
              <SectionLink
                key={section.key}
                section={section}
                active={section.key === activeKey}
              />
            ))}
          </nav>
          <div className="ml-auto hidden min-w-0 items-center gap-3 md:flex">
            <span className="text-muted-foreground truncate text-sm">
              Phaendar table
            </span>
            <span
              aria-hidden
              className="bg-foreground/20 size-8 shrink-0 rounded-full"
            />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <nav
          aria-label="Campaign sections"
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${sections.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {sections.map((section) => (
            <SectionLink
              key={section.key}
              section={section}
              active={section.key === activeKey}
              phone
            />
          ))}
          <span className="text-muted-foreground flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px]">
            <MoreHorizontal className="size-5" aria-hidden />
            More
          </span>
        </nav>
      </div>
    </div>
  );
}
