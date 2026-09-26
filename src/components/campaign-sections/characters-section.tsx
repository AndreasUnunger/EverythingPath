'use client';
import type { Id } from '@convex/_generated/dataModel';
import { GuardedLink } from '~/components/campaign-shell/navigation-guard';
import { CharacterManager } from '~/components/character-manager';
import { campaignPath } from '~/lib/campaign-routes';

// Temporary host for the existing character records. Officer roles, roster
// people and team managers are still corrected through the Militia editor.
export function CharactersSection({
  campaignId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  organizationId: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Officer roles, roster people and team managers are corrected on{' '}
        <GuardedLink
          href={campaignPath(campaignId, 'militia')}
          className="text-primary underline underline-offset-4"
        >
          Militia
        </GuardedLink>
        .
      </p>
      <CharacterManager
        selectedCampaignId={campaignId}
        organizationId={organizationId}
        canQuery
      />
    </div>
  );
}
