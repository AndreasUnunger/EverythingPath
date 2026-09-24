import { ConvexError } from 'convex/values';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { readCutover } from './campaignRuntime';

export async function updateCanonicalCharacter(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  if ((await readCutover(ctx))?.status !== 'canonical') return;
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
  await ctx.db.patch('canonicalMilitiaState', source._id, {
    revision: source.revision + 1,
    snapshot: {
      ...source.snapshot,
      characters,
      roster: {
        ...source.snapshot.roster,
        people: source.snapshot.roster.people.map((p) =>
          p.characterId === characterId
            ? { ...p, kind: character.kind ?? p.kind }
            : p,
        ),
      },
    },
  });
}
