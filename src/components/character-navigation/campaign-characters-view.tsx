import { CampaignCharactersTable } from './campaign-characters-table';
import { pageClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';
import { CharactersTitle } from './characters-title';

// A campaign's Characters page: everyone's, with owner, state and roster.
export function CampaignCharactersView({
  campaignName,
  characters,
  newHref,
}: {
  campaignName: string;
  characters: CampaignCharacterListRow[];
  newHref?: string;
}) {
  return (
    <main className={pageClass}>
      <CharactersTitle eyebrow={campaignName} newHref={newHref} />
      <p className="text-muted-foreground mb-3 text-sm">
        Everyone in {campaignName} can edit these.
      </p>
      {characters.length ? (
        <CampaignCharactersTable characters={characters} />
      ) : (
        <p className="text-muted-foreground py-5 text-sm">
          No characters in this campaign yet.
        </p>
      )}
    </main>
  );
}
