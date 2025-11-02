'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { CampaignOverview } from '~/components/campaign-overview';
import { MilitiaSystem } from '~/components/militia-system';
import { CharacterManager } from '~/components/character-manager';
import { Swords, Users, Shield } from 'lucide-react';
import { useOrganization } from '@clerk/nextjs';
import { useQuery } from 'convex-helpers/react/cache';
import { api as db } from '@convex/_generated/api';
import CampaignSelector from './campaign-selector';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';

export function CampaignDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const { organization } = useOrganization();
  const campaigns = useQuery(
    db.campaign.getCampaigns,
    !!organization?.id ? { organizationId: organization.id } : 'skip',
  );
  const [selectedCampaign, setSelectedCampaign] = useState('0');

  useEffect(() => {
    if (campaigns?.[0]) {
      setSelectedCampaign(campaigns[0]._id);
    }
  }, [campaigns]);

  return (
    <div>
      <header className="border-primary relative mb-4 border-b-2 pb-4"></header>

      <div className="flex items-center gap-6 pb-4 sm:justify-between">
        <CampaignSelector
          campaigns={campaigns}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
        />
        <CreateCampaignDialog />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-card grid w-full grid-cols-3 border-2 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider"
          >
            <Swords className="mr-2 h-5 w-5" />
            OVERVIEW
          </TabsTrigger>
          <TabsTrigger
            value="militia"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider"
          >
            <Shield className="mr-2 h-5 w-5" />
            MILITIA
          </TabsTrigger>
          <TabsTrigger
            value="characters"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground font-mono text-base tracking-wider"
          >
            <Users className="mr-2 h-5 w-5" />
            CHARACTERS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <CampaignOverview
            campaign={campaigns?.find((x) => x._id === selectedCampaign)}
          />
        </TabsContent>

        <TabsContent value="militia" className="space-y-4">
          <MilitiaSystem />
        </TabsContent>

        <TabsContent value="characters" className="space-y-4">
          <CharacterManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
