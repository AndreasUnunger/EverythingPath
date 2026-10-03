import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { cn } from '~/lib/utils';
import { cellClass } from './character-list-classes';
import type { CampaignCharacterListRow } from './character-list-model';
import { CharacterStateBadge } from './character-state-badge';
import { RosterState } from './roster-state';

// Owner and state have their own columns from tablet width; on phone they
// move under the name so the three remaining columns fit.
export function CampaignCharacterRow({
  character,
}: {
  character: CampaignCharacterListRow;
}) {
  const owner = character.ownerName ?? 'Unassigned owner';
  return (
    <tr className="border-foreground/15 border-b">
      <td className={cellClass}>
        {character.href ? (
          <GuardedLink
            href={character.href}
            className="hover:text-primary focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] md:min-h-0"
          >
            {character.name}
          </GuardedLink>
        ) : (
          character.name
        )}
        <span className="text-muted-foreground block text-xs">
          {character.kind}
          <span className="md:hidden">
            {' '}
            · {owner} · {character.active ? 'Active' : 'Archived'}
          </span>
        </span>
      </td>
      <td className={cn(cellClass, 'hidden md:table-cell')}>{owner}</td>
      <td className={cn(cellClass, 'whitespace-nowrap')}>{character.level}</td>
      <td className={cn(cellClass, 'hidden md:table-cell')}>
        <CharacterStateBadge active={character.active} />
      </td>
      <td className={cn(cellClass, 'whitespace-nowrap')}>
        <RosterState isOnRoster={character.isOnRoster === true} />
      </td>
    </tr>
  );
}
