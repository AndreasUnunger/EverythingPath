'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
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
  const [runePattern, setRunePattern] = useState(1);

  useEffect(() => {
    if (campaigns && campaigns[0]) {
      setSelectedCampaign(campaigns[0]._id);
    }
  }, [campaigns]);

  useLayoutEffect(() => {
    setRunePattern(Math.floor(Math.random() * 5 + 1));
  }, []);

  return (
    <div className="container mx-auto max-w-7xl px-2">
      <header className="border-primary relative mb-4 border-b-2 pb-4"></header>

      <div className="flex gap-6 sm:justify-between">
        <CampaignSelector
          campaigns={campaigns}
          selectedCampaign={selectedCampaign}
          setSelectedCampaign={setSelectedCampaign}
        />
        <CreateCampaignDialog />
      </div>
      <div className="rune-divider" data-pattern={runePattern} />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-card glow-border arcane-border grid w-full grid-cols-3 border-2 p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:retro-glow font-mono text-base tracking-wider"
          >
            <Swords className="mr-2 h-5 w-5" />
            OVERVIEW
          </TabsTrigger>
          <TabsTrigger
            value="militia"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:retro-glow font-mono text-base tracking-wider"
          >
            <Shield className="mr-2 h-5 w-5" />
            MILITIA
          </TabsTrigger>
          <TabsTrigger
            value="characters"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:retro-glow font-mono text-base tracking-wider"
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
