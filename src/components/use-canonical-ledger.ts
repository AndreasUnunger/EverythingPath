'use client';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { characterLedgerQuery } from '~/lib/sharedQueries';
import type { SetupCharacter } from './militia-setup/roster';

// The accepted militia and its only write: a reasoned correction bound to
// the revision it was prepared against. Every write carries the campaign and
// militia this hook was mounted for, so a later scope change never
// retargets it.
export function useCanonicalLedger({
  campaignId,
  militiaId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  organizationId: string;
}) {
  const ledger = useQuery(api.canonicalLedger.read, { campaignId, militiaId });
  const saveCorrection = useMutation(api.canonicalLedger.save);
  const { data: records = [] } = characterLedgerQuery(
    campaignId,
    organizationId,
    true,
    true,
  );
  const characters: SetupCharacter[] = records.map((c) => ({
    characterId: c._id,
    name: c.name,
    level: c.level,
    strength: c.strength,
    dexterity: c.dexterity,
    constitution: c.constitution,
    intelligence: c.intelligence,
    wisdom: c.wisdom,
    charisma: c.charisma,
    isActive: c.isActive !== false,
  }));
  return {
    ledger,
    characters,
    save: (correction: {
      expectedRevision: number;
      snapshot: CanonicalWeekState['militiaSnapshot'];
      reason: string;
    }) => saveCorrection({ campaignId, militiaId, ...correction }),
  };
}
