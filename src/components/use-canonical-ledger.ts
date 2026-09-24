'use client';
import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { MilitiaSetup } from '~/lib/canonical-setup';
import { characterLedgerQuery } from '~/lib/sharedQueries';

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
  const { data: characters = [] } = characterLedgerQuery(
    campaignId,
    organizationId,
    true,
    true,
  );
  const [editing, setEditing] = useState<typeof ledger>(undefined);
  return {
    ledger,
    editing,
    characters: characters.map((c) => ({
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
    })),
    toggle: () => setEditing(editing ? undefined : ledger),
    save: async (setup: MilitiaSetup) => {
      if (!editing) return;
      await saveCorrection({
        campaignId,
        militiaId,
        expectedRevision: editing.revision,
        snapshot: setup.state.militiaSnapshot,
        reason: setup.notes,
      });
      setEditing(undefined);
    },
  };
}
