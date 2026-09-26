'use client';
import { useCallback, useState, type ReactNode } from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { useConvexAuth } from 'convex/react';
import { usePathname } from 'next/navigation';
import {
  History,
  LayoutGrid,
  MoreHorizontal,
  Shield,
  Users,
} from 'lucide-react';
import type { Doc } from '@convex/_generated/dataModel';
import { campaignQuery } from '~/lib/sharedQueries';
import { campaignPath, type CampaignSection } from '~/lib/campaign-routes';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
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
import { Skeleton } from '~/components/ui/skeleton';
import { cn } from '~/lib/utils';
import { CampaignWorkspaceProvider } from '~/components/weekly-draft-workspace/campaign-workspace-provider';
import { useWeeklyDraftWorkspace } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import { CampaignProvider } from './campaign-context';
import { FailedLoadCard } from './failed-load';
import {
  BeforeDeparture,
  GuardedLink,
  NavigationGuardProvider,
  useNavigationGuard,
} from './navigation-guard';
import { AccountActions } from './account-actions';
import { ShellSlotHost, ShellSlotProvider } from './shell-slots';
import {
  AccountControl,
  KeepLink,
  OrganizationControl,
  ShellFrame,
  SignIn,
  TopBarRow,
} from './shell-frame';

type Campaign = Doc<'campaign'>;
const ALL_CAMPAIGNS = '__all';

type Organization = { id: string; name: string };
type Session =
  | { kind: 'resolving' }
  | { kind: 'signed_out' }
  | { kind: 'no_organization' }
  | { kind: 'member'; organization: Organization };
type Access =
  | Exclude<Session, { kind: 'member' }>
  | { kind: 'failed'; retry: () => void }
  | { kind: 'unavailable'; organizationName: string }
  | {
      kind: 'ready';
      campaign: Campaign;
      campaigns: Campaign[];
      organizationId: string;
    };
type CampaignListQuery = Pick<
  ReturnType<typeof campaignQuery>,
  'data' | 'error' | 'refetch'
>;

// Who is asking: sign-in and active organization must both be settled before
// any campaign list is read, so nothing from a previous organization shows.
function useSession(): Session {
  const auth = useAuth();
  const { organization, isLoaded: organizationLoaded } = useOrganization();
  const convexAuth = useConvexAuth();
  if (!auth.isLoaded || !organizationLoaded || convexAuth.isLoading)
    return { kind: 'resolving' };
  if (auth.isSignedIn !== true || !convexAuth.isAuthenticated)
    return { kind: 'signed_out' };
  if (!organization) return { kind: 'no_organization' };
  return {
    kind: 'member',
    organization: { id: organization.id, name: organization.name },
  };
}

// The active organization's own campaign list decides access. An explicit id
// that is not in it is unavailable and never falls back to another campaign;
// not found and no access read the same so nothing is disclosed.
export function classifyCampaign(
  campaignId: string,
  organization: Organization,
  query: CampaignListQuery,
): Access {
  if (query.error)
    return {
      kind: 'failed',
      retry: () => {
        void query.refetch();
      },
    };
  if (!query.data) return { kind: 'resolving' };
  const campaigns = query.data.state === 'ready' ? query.data.campaigns : [];
  const campaign = campaigns.find((item) => item._id === campaignId);
  if (!campaign)
    return { kind: 'unavailable', organizationName: organization.name };
  return {
    kind: 'ready',
    campaign,
    campaigns,
    organizationId: organization.id,
  };
}

function useCampaignAccess(campaignId: string): Access {
  const session = useSession();
  const organization =
    session.kind === 'member' ? session.organization : undefined;
  const query = campaignQuery(organization?.id, organization !== undefined);
  return organization
    ? classifyCampaign(campaignId, organization, query)
    : (session as Exclude<Session, { kind: 'member' }>);
}

function CampaignSwitcher({
  campaign,
  campaigns,
}: {
  campaign: Campaign;
  campaigns: Campaign[];
}) {
  const guard = useNavigationGuard();
  return (
    <Select
      value={campaign._id}
      onValueChange={(value) =>
        guard.navigate(
          value === ALL_CAMPAIGNS ? '/campaigns' : campaignPath(value),
        )
      }
    >
      <SelectTrigger
        aria-label="Active campaign"
        className="min-h-9 max-w-[11rem] min-w-0 border-0 bg-transparent px-1 text-sm shadow-none md:text-base xl:max-w-[16rem] dark:bg-transparent [&>span]:truncate"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {campaigns.map((item) => (
          <SelectItem key={item._id} value={item._id} className="min-h-11">
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

type SectionLink = {
  section: CampaignSection;
  label: string;
  short: string;
  href: string;
  icon: typeof LayoutGrid;
};

// The Week label reads the shared Workspace snapshot; the number is known
// only while the week editor's owner is active on the Week route.
function useSections(campaignId: string): SectionLink[] {
  const workspace = useWeeklyDraftWorkspace();
  const week = workspace.status === 'ready' ? workspace.week : null;
  return [
    {
      section: 'week',
      label: week === null ? 'Week' : `Week ${week}`,
      short: 'Week',
      href: campaignPath(campaignId, 'week'),
      icon: LayoutGrid,
    },
    {
      section: 'history',
      label: 'Finished weeks',
      short: 'Finished',
      href: campaignPath(campaignId, 'history'),
      icon: History,
    },
    {
      section: 'militia',
      label: 'Militia',
      short: 'Militia',
      href: campaignPath(campaignId, 'militia'),
      icon: Shield,
    },
    {
      section: 'characters',
      label: 'Characters & officers',
      short: 'Characters',
      href: campaignPath(campaignId, 'characters'),
      icon: Users,
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SectionLinks({ sections }: { sections: SectionLink[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Campaign sections"
      className="hidden shrink-0 items-center gap-1 text-sm md:flex"
    >
      {sections.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <GuardedLink
            key={item.section}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 rounded-md px-3 py-1.5 whitespace-nowrap outline-none focus-visible:ring-[3px]',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/10',
            )}
          >
            {item.label}
          </GuardedLink>
        );
      })}
    </nav>
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

// Each control gets its own full-width row, so a long organization name
// truncates inside its control instead of colliding with the label. Focus
// returns to the More button on dismissal (Radix). Any choice that commits a
// departure (organization change, Clerk modals) closes the sheet first.
function MoreSheet() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
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
          <SheetDescription>Organization and account.</SheetDescription>
        </SheetHeader>
        <BeforeDeparture onCommit={close}>
          <div className="flex flex-col px-4 pb-4">
            <MoreGroup label="Organization">
              <OrganizationControl fill />
            </MoreGroup>
            <MoreGroup label="Account">
              <AccountActions />
            </MoreGroup>
          </div>
        </BeforeDeparture>
      </SheetContent>
    </Sheet>
  );
}

// Phone: four section tabs plus More. Sticky at the column's end so content,
// alerts and save buttons stay reachable above it, including above the
// on-screen keyboard (the viewport resizes its content) and the home
// indicator (safe-area padding). The Week frame fills the status-strip host
// immediately above the tabs.
function BottomBar({ sections }: { sections: SectionLink[] }) {
  const pathname = usePathname();
  return (
    <div className="bg-background/95 border-foreground/15 sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ShellSlotHost
        name="phone-status-strip"
        className="border-foreground/15 border-b"
      />
      <nav aria-label="Campaign sections" className="grid grid-cols-5">
        {sections.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <GuardedLink
              key={item.section}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring/50 flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span aria-hidden>{item.short}</span>
            </GuardedLink>
          );
        })}
        <MoreSheet key={pathname} />
      </nav>
    </div>
  );
}

function CampaignStateCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
      <Card className="gap-4 p-6">
        <h1 className="text-xl">{title}</h1>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </Card>
    </main>
  );
}

function BackToCampaigns() {
  return (
    <Button asChild variant="outline">
      <GuardedLink href="/campaigns">Back to campaigns</GuardedLink>
    </Button>
  );
}

function CampaignState({
  access,
}: {
  access: Exclude<Access, { kind: 'ready' }>;
}) {
  switch (access.kind) {
    case 'resolving':
      return (
        <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
          <p role="status" className="sr-only">
            Loading campaign…
          </p>
          <Skeleton aria-hidden className="mb-4 h-8 w-64" />
          <Skeleton aria-hidden className="h-40 w-full" />
        </main>
      );
    case 'signed_out':
      return (
        <CampaignStateCard title="Sign in to open this campaign.">
          <SignIn />
        </CampaignStateCard>
      );
    case 'no_organization':
      return (
        <CampaignStateCard title="This campaign isn't available.">
          <p className="text-muted-foreground w-full text-sm">
            Choose an organization to continue.
          </p>
          <OrganizationControl />
          <BackToCampaigns />
        </CampaignStateCard>
      );
    case 'failed':
      return (
        <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <FailedLoadCard noun="The campaign" retry={access.retry} />
        </main>
      );
    case 'unavailable':
      return (
        <CampaignStateCard
          title={`This campaign isn't available in ${access.organizationName}.`}
        >
          <OrganizationControl />
          <BackToCampaigns />
        </CampaignStateCard>
      );
  }
}

function CampaignTopBar({
  access,
  sections,
}: {
  access: Access;
  sections: SectionLink[];
}) {
  const ready = access.kind === 'ready';
  return (
    <TopBarRow>
      <KeepLink />
      <span className="text-muted-foreground hidden md:inline" aria-hidden>
        /
      </span>
      {ready ? (
        <CampaignSwitcher
          campaign={access.campaign}
          campaigns={access.campaigns}
        />
      ) : access.kind === 'resolving' ? (
        <Skeleton aria-hidden className="h-5 w-32" />
      ) : null}
      {ready && <SectionLinks sections={sections} />}
      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 md:gap-3">
        {ready && (
          <ShellSlotHost
            name="top-bar-status"
            className="flex min-w-0 items-center gap-2"
          />
        )}
        <span className={cn(ready ? 'hidden md:inline-flex' : 'inline-flex')}>
          <OrganizationControl />
        </span>
        <span className={cn(ready ? 'hidden md:inline-flex' : 'inline-flex')}>
          <AccountControl />
        </span>
      </div>
    </TopBarRow>
  );
}

function CampaignShellContent({
  access,
  children,
}: {
  access: Access;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const ready = access.kind === 'ready';
  const sections = useSections(ready ? access.campaign._id : '');
  // The Week route gets the remaining viewport as a bounded host at every
  // width so the Week frame can pin its stepper, footer and phone strip
  // while its editor scrolls. Every other section keeps ordinary document
  // scrolling for its current forms.
  const week = ready && pathname === campaignPath(access.campaign._id, 'week');
  return (
    <ShellFrame
      header={<CampaignTopBar access={access} sections={sections} />}
      footer={ready ? <BottomBar sections={sections} /> : null}
      bounded={week}
    >
      {access.kind === 'ready' ? (
        <CampaignProvider
          key={access.campaign._id}
          value={{
            campaign: access.campaign,
            organizationId: access.organizationId,
          }}
        >
          {week ? (
            <div
              data-week-host
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              {children}
            </div>
          ) : (
            children
          )}
        </CampaignProvider>
      ) : (
        <CampaignState access={access} />
      )}
    </ShellFrame>
  );
}

// The Workspace owner sits above the shell and the page: the Week route
// renders the editor, the top bar reads its week, and the departure guard
// reads its pending work. It is active only on the verified campaign's Week.
export function CampaignShell({
  campaignId,
  children,
}: {
  campaignId: string;
  children: ReactNode;
}) {
  const access = useCampaignAccess(campaignId);
  const pathname = usePathname();
  const verified = access.kind === 'ready' ? access.campaign._id : null;
  return (
    <CampaignWorkspaceProvider
      campaignId={verified}
      active={verified !== null && pathname === campaignPath(verified, 'week')}
    >
      <NavigationGuardProvider>
        <ShellSlotProvider>
          <CampaignShellContent access={access}>
            {children}
          </CampaignShellContent>
        </ShellSlotProvider>
      </NavigationGuardProvider>
    </CampaignWorkspaceProvider>
  );
}
