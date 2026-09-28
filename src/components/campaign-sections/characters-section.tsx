'use client';
import type { Id } from '@convex/_generated/dataModel';
import { CharacterRecordDialog } from '~/components/character-manager/character-record-dialog';
import { CharactersOfficersView } from '~/components/characters-officers/characters-officers-view';
import { CharactersSkeleton } from '~/components/characters-officers/characters-skeleton';
import { useCharactersPage } from '~/components/characters-officers/use-characters-page';

// Characters & officers: the officer board over the character table, with
// the record dialog. Roster and officer corrections still happen on the
// Militia page's People & officers fallback.
export function CharactersSection({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  const page = useCharactersPage({ campaignId, organizationId });
  if (page.status === 'loading') return <CharactersSkeleton />;
  const { dialog } = page;
  return (
    <>
      <CharactersOfficersView page={page} />
      {dialog.target && (dialog.target.kind === 'add' || dialog.record) ? (
        // One dialog per target: an edit starts from the record's values.
        <CharacterRecordDialog
          key={dialog.target.kind === 'add' ? 'add' : dialog.target.id}
          campaignId={campaignId}
          organizationId={organizationId}
          record={dialog.record}
          open
          onOpenChange={(open) => {
            if (!open) dialog.close();
          }}
          archiveWarning={dialog.archiveWarning}
        />
      ) : null}
    </>
  );
}
