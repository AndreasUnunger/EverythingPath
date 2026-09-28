'use client';
import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { CanonicalWeekState } from '~/lib/canonical-weekly-source';
import { characterLedgerQuery } from '~/lib/sharedQueries';
import {
  mirrorRosterKinds,
  normalizeCharacterKind,
} from '~/lib/character-kind';
import type { SetupCharacter } from '~/lib/setup-characters';

type Snapshot = CanonicalWeekState['militiaSnapshot'];

// The accepted militia and its only write: a reasoned correction bound to
// the revision it was prepared against. Every write carries the campaign and
// militia this hook was mounted for, so a later scope change never
// retargets it.
//
// Once loaded, a scope's militia never goes back to loading. A moment
// without a result (while the subscription is re-established) would unmount
// an open correction and mount it again: its menus and pickers would close,
// and its heading would take focus from the control in use (#141).
export function useLedgerCorrection({
  campaignId,
  militiaId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
}) {
  const result = useQuery(api.canonicalLedger.read, { campaignId, militiaId });
  const scope = `${campaignId}:${militiaId}`;
  const [kept, keep] = useState<{
    scope: string;
    ledger: NonNullable<typeof result>;
  } | null>(null);
  if (result !== undefined && (kept?.ledger !== result || kept.scope !== scope))
    keep({ scope, ledger: result });
  const ledger = result ?? (kept?.scope === scope ? kept.ledger : undefined);
  const saveCorrection = useMutation(api.canonicalLedger.save);
  return {
    ledger,
    write: (correction: {
      expectedRevision: number;
      snapshot: Snapshot;
      reason: string;
    }) => saveCorrection({ campaignId, militiaId, ...correction }),
  };
}

// The Militia page's ledger: the correction write, sending roster kinds as
// the current records' PC or NPC; the server mirrors them again from the
// records it reads.
export function useCanonicalLedger({
  campaignId,
  militiaId,
  organizationId,
}: {
  campaignId: Id<'campaign'>;
  militiaId: Id<'militia'>;
  organizationId: string;
}) {
  const { ledger, write } = useLedgerCorrection({ campaignId, militiaId });
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
    kind: normalizeCharacterKind(c.kind),
  }));
  return {
    ledger,
    characters,
    save: (correction: {
      expectedRevision: number;
      snapshot: Snapshot;
      reason: string;
    }) =>
      write({
        ...correction,
        snapshot: {
          ...correction.snapshot,
          roster: mirrorRosterKinds(correction.snapshot.roster, characters),
        },
      }),
  };
}
