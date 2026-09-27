import { ConvexError } from 'convex/values';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import {
  mirrorRosterKinds,
  normalizeCharacterKind,
  type RosterKind,
} from '../../src/lib/character-kind';

export async function updateCanonicalCharacter(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new ConvexError('Character not found');
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', character.campaignId))
    .unique();
  if (!militia) return;
  const source = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
    .unique();
  if (!source) return;
  const facts = {
    characterId,
    level: character.level,
    strength: character.strength,
    dexterity: character.dexterity,
    constitution: character.constitution,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    charisma: character.charisma,
    isActive: character.isActive !== false,
  };
  const characters = source.snapshot.characters.some(
    (c) => c.characterId === characterId,
  )
    ? source.snapshot.characters.map((c) =>
        c.characterId === characterId ? facts : c,
      )
    : [...source.snapshot.characters, facts];
  // The record owns the kind: its roster mirror follows in the same write,
  // and an absent record kind is the PC default.
  const kind = normalizeCharacterKind(character.kind);
  await ctx.db.patch('canonicalMilitiaState', source._id, {
    revision: source.revision + 1,
    snapshot: {
      ...source.snapshot,
      characters,
      roster: {
        ...source.snapshot.roster,
        people: source.snapshot.roster.people.map((p) =>
          p.characterId === characterId ? { ...p, kind } : p,
        ),
      },
    },
  });
}

// A live source about to be written, with every roster kind resolved against
// the campaign's current records, so a stale or old-client payload can never
// restore an earlier kind. People without a record in this campaign keep their
// own normalized kind; reference checks decide whether they may stay.
export async function withCurrentRecordKinds<
  Snapshot extends {
    roster: { people: { characterId: string; kind: RosterKind }[] };
  },
>(
  ctx: MutationCtx,
  campaignId: Id<'campaign'>,
  snapshot: Snapshot,
): Promise<Snapshot> {
  const records = [];
  for (const { characterId } of snapshot.roster.people) {
    const id = ctx.db.normalizeId('character', characterId);
    const record = id && (await ctx.db.get('character', id));
    if (record?.campaignId === campaignId)
      records.push({ characterId, kind: record.kind });
  }
  return {
    ...snapshot,
    roster: mirrorRosterKinds(snapshot.roster, records),
  };
}
