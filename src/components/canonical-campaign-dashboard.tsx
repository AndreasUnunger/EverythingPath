'use client';
import { useState } from 'react';
import { useOrganization } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { campaignQuery } from '~/lib/sharedQueries';
import { useCanonicalLedger } from './use-canonical-ledger';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import CampaignSelector from './campaign-selector';
import CreateCampaignDialog from '~/app/campaigns/createCampaignDialog';
import { CanonicalWorkspaceScreen } from './weekly-draft-workspace/board';
import { MilitiaSetupForm } from './militia-setup/form';
import { CharacterManager } from './character-manager';

function MilitiaLedger({
  campaignId,
  militiaId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  organizationId: string;
}) {
  const { ledger, editing, characters, toggle, save } = useCanonicalLedger({
    campaignId,
    militiaId,
    organizationId,
  });
  if (!ledger) return <p role="status">Loading militia ledger…</p>;
  return (
    <div className="space-y-4">
      <CharacterManager
        selectedCampaignId={campaignId}
        organizationId={organizationId}
        canQuery
      />
      <p className="text-muted-foreground text-sm">
        Correct militia values, assign officers and managers, or update teams
        and assets. Weekly actions belong on the week board.
      </p>
      <Button variant="outline" onClick={toggle}>
        {editing ? 'Close correction' : 'Edit militia ledger'}
      </Button>
      {editing && (
        <MilitiaSetupForm
          correction
          initialValues={{
            mode: 'existing',
            phase: 'upkeep',
            notes: '',
            state: editing.state,
          }}
          characters={characters}
          onSave={save}
        />
      )}
    </div>
  );
}

function CampaignWorkspace({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  const source = useQuery(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  return (
    <Tabs defaultValue="week" className="space-y-4">
      <TabsList>
        <TabsTrigger value="week">Militia week</TabsTrigger>
        <TabsTrigger value="ledger">Ledger</TabsTrigger>
      </TabsList>
      <TabsContent value="week">
        <CanonicalWorkspaceScreen campaign={campaignId} />
      </TabsContent>
      <TabsContent value="ledger">
        {source === undefined ? (
          <p role="status">Loading militia ledger…</p>
        ) : source ? (
          <MilitiaLedger
            campaignId={campaignId}
            militiaId={source.key.militiaId}
            organizationId={organizationId}
          />
        ) : (
          <CharacterManager
            selectedCampaignId={campaignId}
            organizationId={organizationId}
            canQuery
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

export function CanonicalCampaignDashboard() {
  const { organization, isLoaded } = useOrganization();
  const { data, error } = campaignQuery(organization?.id, isLoaded);
  const [selected, setSelected] = useState<Id<'campaign'>>();
  if (error)
    return (
      <Card role="alert" className="p-4">
        Campaigns could not be loaded. Please try again.
      </Card>
    );
  if (!isLoaded || !data) return <p role="status">Loading campaigns…</p>;
  if (data.state !== 'ready' || !organization)
    return (
      <Card className="p-4">Select an organization with campaign access.</Card>
    );
  const campaignId =
    data.campaigns.find((c) => c._id === selected)?._id ??
    data.campaigns[0]?._id;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CampaignSelector
          campaigns={data.campaigns}
          selectedCampaign={campaignId}
          setSelectedCampaign={setSelected}
        />
        <CreateCampaignDialog />
      </div>
      {campaignId ? (
        <CampaignWorkspace
          key={campaignId}
          campaignId={campaignId}
          organizationId={organization.id}
        />
      ) : (
        <p>Create a campaign to get started.</p>
      )}
    </div>
  );
}
