import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

export const maxSpellBrowserMetadataRows = 128;

export async function updateSpellCatalogSummary({
  ctx,
  row,
  delta,
}: {
  ctx: MutationCtx;
  row: Pick<
    Doc<'spellCatalogIndex'>,
    | 'characterId'
    | 'castingClassId'
    | 'level'
    | 'school'
    | 'available'
    | 'recorded'
  >;
  delta: 1 | -1;
}) {
  if (delta < 0 && row.recorded === undefined) return;
  const groups = [
    { kind: 'level', value: row.level },
    { kind: 'school', value: row.school },
  ] as const;
  for (const group of groups) {
    const previous = await ctx.db
      .query('spellCatalogSummary')
      .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
        q
          .eq('characterId', row.characterId)
          .eq('castingClassId', row.castingClassId)
          .eq('kind', group.kind)
          .eq('value', group.value),
      )
      .unique();
    if (!previous && delta < 0) continue;
    const counts = {
      count: (previous?.count ?? 0) + delta,
      availableCount:
        (previous?.availableCount ?? 0) + (row.available ? delta : 0),
      unrecordedCount:
        (previous?.unrecordedCount ?? 0) +
        (row.available && !row.recorded ? delta : 0),
    };
    if (previous && counts.count === 0) {
      await ctx.db.delete('spellCatalogSummary', previous._id);
      continue;
    }
    if (previous) {
      await ctx.db.patch('spellCatalogSummary', previous._id, counts);
      continue;
    }
    const existingGroups = await ctx.db
      .query('spellCatalogSummary')
      .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
        q
          .eq('characterId', row.characterId)
          .eq('castingClassId', row.castingClassId)
          .eq('kind', group.kind),
      )
      .take(maxSpellBrowserMetadataRows);
    if (existingGroups.length >= maxSpellBrowserMetadataRows)
      throw new ConvexError('Spell catalog has too many levels or schools');
    await ctx.db.insert('spellCatalogSummary', {
      characterId: row.characterId,
      castingClassId: row.castingClassId,
      ...group,
      ...counts,
    });
  }
}
