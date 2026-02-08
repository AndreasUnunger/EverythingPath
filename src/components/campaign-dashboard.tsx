'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { MilitiaSystem } from '~/components/militia-system';
import { Users, Swords } from 'lucide-react';
import { useOrganization } from '@clerk/nextjs';
import CampaignSelector from './campaign-selector';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';
import { CampaignInfo } from './campaignInfo';
import { Ledger } from './ledger';
import { campaignQuery, militiaQuery } from '~/lib/sharedQueries';

export function CampaignDashboard() {
  const [activeTab, setActiveTab] = useState('militia');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('0');

  const { organization } = useOrganization();
  const { data: campaigns } = campaignQuery(organization?.id);
  const selectedCampaign = campaigns?.find((x) => x._id === selectedCampaignId);

  useEffect(() => {
    if (campaigns?.[0]) {
      setSelectedCampaignId(campaigns[0]._id);
    }
  }, [campaigns]);

  const { data: militia } = militiaQuery(
    selectedCampaign?._id,
    organization?.id,
  );

  return (
    <div>
      <header className="border-primary relative mb-4 border-b-2 pb-4"></header>

      <div className="flex items-center gap-6 pb-4 sm:justify-between">
        <CampaignSelector
          campaigns={campaigns}
          selectedCampaign={selectedCampaignId}
          setSelectedCampaign={setSelectedCampaignId}
        />
        <CreateCampaignDialog />
      </div>

      <CampaignInfo
        campaign={campaigns?.find((x) => x._id === selectedCampaignId)}
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
            militia={militia}
            campaign={campaigns?.find((x) => x._id == selectedCampaignId)}
          />
        </TabsContent>

        <TabsContent value="characters" className="space-y-4">
          <Ledger selectedCampaignId={selectedCampaignId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
