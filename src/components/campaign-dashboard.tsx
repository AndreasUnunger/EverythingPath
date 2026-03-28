'use client';

import { useMemo, useState } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { MilitiaSystem } from '~/components/militia-system';
import { Users, Swords } from 'lucide-react';
import { useOrganization } from '@clerk/nextjs';
import CampaignSelector from './campaign-selector';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';
import { CampaignInfo } from './campaignInfo';
import { Ledger } from './ledger';
import {
  campaignQuery,
  marketplaceLedgerQuery,
  militiaQuery,
  militiaStateSetupQuery,
} from '~/lib/sharedQueries';

export function CampaignDashboard() {
  const [activeTab, setActiveTab] = useState('militia');
  const [selectedCampaignId, setSelectedCampaignId] = useState<
    Id<'campaign'> | undefined
  >(undefined);

  const { organization, isLoaded } = useOrganization();
  const organizationId = organization?.id;
  const {
    data: campaignContext,
    isLoading: isLoadingCampaignContext,
    error: campaignContextError,
  } = campaignQuery(organizationId, isLoaded);
  const campaigns =
    campaignContext?.state === 'ready' ? campaignContext.campaigns : undefined;
  const canLoadOrgData = Boolean(
    isLoaded && organizationId && campaignContext?.state === 'ready',
  );
  const effectiveSelectedCampaignId = useMemo(() => {
    if (!campaigns?.length) {
      return undefined;
    }
    if (selectedCampaignId && campaigns.some((campaign) => campaign._id === selectedCampaignId)) {
      return selectedCampaignId;
    }
    return campaigns[0]?._id;
  }, [campaigns, selectedCampaignId]);
  const selectedCampaign = campaigns?.find((x) => x._id === effectiveSelectedCampaignId);

  const { data: militia } = militiaQuery(
    selectedCampaign?._id,
    organizationId,
    canLoadOrgData,
  );
  const { data: marketplaceLedger } = marketplaceLedgerQuery(
    selectedCampaign?._id,
    organizationId,
    canLoadOrgData,
  );
  const { data: militiaStateSetup } = militiaStateSetupQuery(
    selectedCampaign?._id,
    organizationId,
    canLoadOrgData,
  );

  if (!isLoaded) {
    return (
      <p className="text-muted-foreground font-mono text-sm tracking-wide">
        Loading organization context...
      </p>
    );
  }

  if (campaignContextError) {
    return (
      <div className="bg-card border-primary/40 space-y-2 border p-4">
        <p className="font-mono text-sm tracking-wide">
          Unable to load campaigns
        </p>
        <p className="text-muted-foreground font-mono text-sm">
          Please refresh the page and try again.
        </p>
      </div>
    );
  }

  if (isLoadingCampaignContext || !campaignContext) {
    return (
      <p className="text-muted-foreground font-mono text-sm tracking-wide">
        Verifying organization access...
      </p>
    );
  }

  if (campaignContext.state === 'no_org_selected') {
    return (
      <div className="bg-card border-primary/40 space-y-2 border p-4">
        <p className="font-mono text-sm tracking-wide">
          No active organization selected
        </p>
        <p className="text-muted-foreground font-mono text-sm">
          Use the organization switcher in the sidebar to select or create an
          organization before opening Campaigns.
        </p>
      </div>
    );
  }

  if (campaignContext.state === 'no_access') {
    return (
      <div className="bg-card border-primary/40 space-y-2 border p-4">
        <p className="font-mono text-sm tracking-wide">
          Organization access not synced yet
        </p>
        <p className="text-muted-foreground font-mono text-sm">
          You are signed in, but this organization is not available in Convex
          yet. Join the organization in Clerk (or switch to one you already
          belong to), then refresh this page in a few seconds.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-6 pb-4 sm:justify-between">
        <CampaignSelector
          campaigns={campaigns}
          selectedCampaign={effectiveSelectedCampaignId}
          setSelectedCampaign={setSelectedCampaignId}
        />
        <CreateCampaignDialog />
      </div>

      <CampaignInfo
        campaign={selectedCampaign}
        militia={militia ?? undefined}
        militiaStateSetup={militiaStateSetup ?? undefined}
        marketplaceLedger={marketplaceLedger ?? undefined}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-card grid w-full grid-cols-2 border-2 p-1">
          {/* <TabsTrigger */}
          {/*   value="overview" */}
          {/*   className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider" */}
          {/* > */}
          {/*   <Swords className="mr-2 h-5 w-5" /> */}
          {/*   OVERVIEW */}
          {/* </TabsTrigger> */}
          <TabsTrigger
            value="militia"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider"
          >
            <Swords className="mr-2 h-5 w-5" />
            ADVANCE MILITIA
          </TabsTrigger>
          <TabsTrigger
            value="characters"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider"
          >
            <Users className="mr-2 h-5 w-5" />
            LEDGER
          </TabsTrigger>
        </TabsList>

        {/* <TabsContent value="overview" className="space-y-4"> */}
        {/*   <CampaignOverview */}
        {/*     campaign={campaigns?.find((x) => x._id === selectedCampaign)} */}
        {/*   /> */}
        {/* </TabsContent> */}

        <TabsContent value="militia" className="space-y-4">
          <MilitiaSystem
            militia={militia ?? undefined}
            campaign={selectedCampaign}
          />
        </TabsContent>

        <TabsContent value="characters" className="space-y-4">
          <Ledger
            selectedCampaignId={effectiveSelectedCampaignId}
            organizationId={organizationId ?? ''}
            canQuery={canLoadOrgData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
