'use client';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { CharacterManager } from '~/components/character-manager';
import { MilitiaSetupForm } from '~/components/militia-setup/form';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { useCanonicalLedger } from '~/components/use-canonical-ledger';
import { campaignPath } from '~/lib/campaign-routes';

// Temporary host for the existing correction editor: values, teams with
// managers, settlements, assets, roster and officer roles behind one required
// reason. Militia corrections and Characters & officers replace it later.
export function MilitiaLedger({
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

export function MilitiaSection({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  const source = useQuery(api.canonicalDraftPersistence.workspace, {
    campaignId,
  });
  if (source === undefined) return <p role="status">Loading militia ledger…</p>;
  if (source)
    return (
      <MilitiaLedger
        campaignId={campaignId}
        militiaId={source.key.militiaId}
        organizationId={organizationId}
      />
    );
  return (
    <div className="space-y-4">
      <Card role="status" className="gap-3 p-4">
        <p>No militia yet.</p>
        <div>
          <Button asChild>
            <GuardedLink href={campaignPath(campaignId, 'setup')}>
              Set up militia
            </GuardedLink>
          </Button>
        </div>
      </Card>
      <CharacterManager
        selectedCampaignId={campaignId}
        organizationId={organizationId}
        canQuery
      />
    </div>
  );
}
