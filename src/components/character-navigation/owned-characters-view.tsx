import { pageClass } from './character-list-classes';
import type { CharacterListGroup } from './character-list-model';
import { CharactersTitle } from './characters-title';
import { OwnedCharacterGroup } from './owned-character-group';

// The Characters area: my Characters by campaign, No campaign first.
export function OwnedCharactersView({
  groups,
  newHref,
}: {
  groups: CharacterListGroup[];
  newHref?: string;
}) {
  return (
    <main className={pageClass}>
      <CharactersTitle newHref={newHref} />
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <OwnedCharacterGroup key={group.key} group={group} />
        ))}
      </div>
    </main>
  );
}
