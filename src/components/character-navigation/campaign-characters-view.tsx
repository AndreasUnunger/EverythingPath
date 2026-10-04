'use client';
import type { ReactNode } from 'react';
import { MaintenanceReason } from '~/components/campaign-shell/maintenance-reason';
import { useInitialMigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type { CampaignScope } from '~/lib/campaign-scope';
import { CampaignCharactersTable } from './campaign-characters-table';
import { pageClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';
import { CharactersTitle } from './characters-title';

// A campaign's Characters page: everyone's, with owner, state and roster,
// and the player's own ways to bring Characters here.
export function CampaignCharactersView({
  campaignName,
  scope,
  characters,
  addFromMine,
  newHref,
}: {
  campaignName: string;
  scope: CampaignScope;
  characters: CampaignCharacterListRow[];
  /** Add from my characters, where this campaign takes moved Characters. */
  addFromMine?: ReactNode;
  newHref?: string;
}) {
  const maintenance = useInitialMigrationMaintenance();
  return (
    <main className={pageClass}>
      <CharactersTitle
        eyebrow={campaignName}
        actions={addFromMine}
        newHref={newHref}
      />
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone in {campaignName} can edit these.
      </p>
      {characters.length ? <MaintenanceReason notice={maintenance} /> : null}
      {characters.length ? (
        <CampaignCharactersTable characters={characters} scope={scope} />
      ) : (
        <p className="text-muted-foreground py-5 text-sm">
          No characters in this campaign yet.
        </p>
      )}
    </main>
  );
}
