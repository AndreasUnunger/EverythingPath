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
import { correctionStagedChoices } from '~/lib/correction-staged-choices';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import { weeklyDraftSchema } from '~/lib/weekly-draft-contract';
import { phaseLabels } from '~/components/weekly-draft-workspace/week-frame/labels';

// Names the week phases whose staged choices the correction would orphan, so
// the table can review them there; the correction itself stays allowed.
function useStagedChoiceNotice(key: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  draftId: string;
}) {
  const observation = useQuery(api.canonicalDraftPersistence.observe, key);
  const draft =
    observation?.status === 'open'
      ? weeklyDraftSchema.safeParse(observation.draft)
      : null;
  if (!draft?.success) return undefined;
  return (
    current: MilitiaSetup['state']['militiaSnapshot'],
    setup: MilitiaSetup,
  ) => {
    const affected = correctionStagedChoices(
      draft.data,
      current,
      setup.state.militiaSnapshot,
    );
    if (affected.length === 0) return null;
    const phases = affected
      .map(
        ({ phase, count }) =>
          `${phaseLabels[phase]} (${count} ${count === 1 ? 'choice' : 'choices'})`,
      )
      .join(', ');
    return `This correction removes something that choices already staged for the current week use: ${phases}. After saving, review those choices in the week; Upkeep lets you clear a staged decision for a removed team.`;
  };
}

// Temporary host for the existing correction editor: values, teams with
// managers, settlements, assets, roster and officer roles behind one required
// reason. Militia corrections and Characters & officers replace it later.
export function MilitiaLedger({
  campaignId,
  militiaId,
  draftId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  draftId: string;
  organizationId: string;
}) {
  const stagedNotice = useStagedChoiceNotice({
    campaignId,
    militiaId,
    draftId,
  });
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
          stagedChoiceNotice={
            stagedNotice &&
            ((setup) => stagedNotice(editing.state.militiaSnapshot, setup))
          }
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
        draftId={source.key.draftId}
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
