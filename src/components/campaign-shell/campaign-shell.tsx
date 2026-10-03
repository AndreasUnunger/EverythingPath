'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { Doc } from '@convex/_generated/dataModel';
import { useCampaignQuery } from '~/lib/sharedQueries';
import { campaignPath } from '~/lib/campaign-routes';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { CampaignWorkspaceProvider } from '~/components/weekly-draft-workspace/campaign-workspace-provider';
import { useWeeklyDraftWorkspace } from '~/components/weekly-draft-workspace/use-weekly-draft-workspace';
import { CampaignProvider } from './campaign-context';
import { useSession, type Organization, type Session } from './session';
import { FailedLoadCard, reloadPage } from './failed-load';
import { GuardedLink, NavigationGuardProvider } from './navigation-guard';
import { ShellSlotProvider } from './shell-slots';
import { OrganizationControl, ShellFrame, SignIn } from './shell-frame';
import { AppMilitiaRail } from './app-militia-rail';
import { AppPhoneBar } from './app-phone-bar';
import { AppTopBar } from './app-top-bar';
import { useCampaignShellNavigation } from './use-campaign-shell-navigation';
type Campaign = Doc<'campaign'>;

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
  ReturnType<typeof useCampaignQuery>,
  'data' | 'error' | 'refetch'
>;

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
  const query = useCampaignQuery(organization?.id, organization !== undefined);
  return organization
    ? classifyCampaign(campaignId, organization, query)
    : (session as Exclude<Session, { kind: 'member' }>);
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
    case 'unreachable':
      return (
        <main className="mx-auto w-full max-w-2xl p-4 md:p-6">
          <FailedLoadCard
            noun="The campaign"
            hint="Check your connection and try again."
            retry={reloadPage}
          />
        </main>
      );
    default:
      return access satisfies never;
  }
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
  const workspace = useWeeklyDraftWorkspace();
  const nav = useCampaignShellNavigation({
    campaign: ready ? access.campaign : undefined,
    campaigns: ready ? access.campaigns : [],
    organizationId: ready ? access.organizationId : undefined,
    week: workspace.status === 'ready' ? workspace.week : undefined,
  });
  const week = ready && pathname === campaignPath(access.campaign._id, 'week');
  const rail = ready && nav.showMilitiaRail;
  return (
    <ShellFrame
      header={<AppTopBar nav={nav} />}
      footer={<AppPhoneBar nav={nav} />}
      bounded={week}
      withRail={rail}
    >
      {access.kind === 'ready' ? (
        <CampaignProvider
          key={access.campaign._id}
          value={{
            campaign: access.campaign,
            organizationId: access.organizationId,
          }}
        >
          <div className="flex min-h-0 flex-1">
            {rail ? <AppMilitiaRail links={nav.militiaPages} /> : null}
            <div
              data-week-host={week || undefined}
              className={`flex min-h-0 min-w-0 flex-1 flex-col ${week ? 'overflow-y-auto' : rail ? 'md:overflow-y-auto' : ''}`}
            >
              {children}
            </div>
          </div>
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
