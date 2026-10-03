import { ConvexError } from 'convex/values';
import type { WithoutSystemFields } from 'convex/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { listCatalogDependencies } from './preparedCharacterSheet';
import type { LoadedCharacterSheet } from './characterSheet';

export type SpellCatalogSheet = Pick<
  LoadedCharacterSheet,
  'character' | 'entries' | 'catalogEntries'
>;
import { updateSpellCatalogSummary } from './spellCatalogSummary';

export async function reconcileSpellDefinition({
  ctx,
  sheet,
  catalogEntryId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  catalogEntryId: Id<'catalogEntry'>;
}) {
  const definition = await ctx.db.get('catalogEntry', catalogEntryId);
  if (definition?.detail.kind !== 'spell') return;
  if (
    definition.scope !== 'global' &&
    !(
      definition.scope === 'campaign' &&
      definition.campaignId === sheet.character.campaignId
    ) &&
    !(
      definition.scope === 'character' &&
      definition.characterId === sheet.character._id
    )
  )
    throw new ConvexError('Spell does not belong to this Character');
  if (definition.importedSpell && definition.scope === 'character') {
    const isNeeded =
      sheet.entries.some(
        (entry) =>
          'catalogEntryId' in entry && entry.catalogEntryId === catalogEntryId,
      ) ||
      sheet.catalogEntries.some(
        (catalog) =>
          catalog._id !== catalogEntryId &&
          listCatalogDependencies(catalog).some(
            ({ id }) => id === catalogEntryId,
          ),
      );
    const browseOnly = isNeeded ? undefined : true;
    if (definition.browseOnly !== browseOnly)
      await ctx.db.patch('catalogEntry', catalogEntryId, { browseOnly });
    sheet.catalogEntries = sheet.catalogEntries.filter(
      (row) => row._id !== catalogEntryId,
    );
    if (isNeeded) sheet.catalogEntries.push({ ...definition, browseOnly });
  }
  const previous = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_ruleIdentity', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('ruleIdentity', definition.ruleIdentity),
    )
    .take(65);
  if (previous.length > 64)
    throw new ConvexError('Spell has too many casting lists');
  for (const row of previous) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
  // Rows installed before identity indexing are reconciled without crossing sheets.
  for (const catalog of [
    definition,
    ...sheet.catalogEntries.filter(
      (catalog) => catalog.ruleIdentity === definition.ruleIdentity,
    ),
  ]) {
    const legacyRows = await ctx.db
      .query('spellCatalogIndex')
      .withIndex('by_characterId_and_catalogEntryId', (q) =>
        q
          .eq('characterId', sheet.character._id)
          .eq('catalogEntryId', catalog._id),
      )
      .take(65);
    if (legacyRows.length > 64)
      throw new ConvexError('Spell has too many casting lists');
    for (const row of legacyRows) {
      if (
        row.characterId !== sheet.character._id ||
        row.ruleIdentity !== undefined
      )
        continue;
      await updateSpellCatalogSummary({ ctx, row, delta: -1 });
      await ctx.db.delete('spellCatalogIndex', row._id);
    }
  }
  await syncSpellCatalogIndex({ ctx, definition, sheet });
}

export async function deleteSpellCatalogIndex(
  ctx: MutationCtx,
  catalogEntryId: Id<'catalogEntry'>,
) {
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_catalogEntryId', (q) =>
      q.eq('catalogEntryId', catalogEntryId),
    )
    .take(65);
  if (rows.length > 64)
    throw new ConvexError('Spell has too many casting lists');
  for (const row of rows) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
}

async function syncSpellCatalogIndex({
  ctx,
  definition,
  sheet,
}: {
  ctx: MutationCtx;
  definition: Doc<'catalogEntry'>;
  sheet: SpellCatalogSheet;
}) {
  if (definition.detail.kind !== 'spell') return;
  const classes = sheet.catalogEntries.filter(
    (row) =>
      row.detail.kind === 'class' &&
      'casting' in row.detail &&
      row.detail.casting,
  );
  if (classes.length > 64)
    throw new ConvexError('Character has too many casting lists');
  for (const castingClass of classes) {
    if (
      castingClass.detail.kind !== 'class' ||
      !('casting' in castingClass.detail) ||
      !castingClass.detail.casting
    )
      continue;
    const classTag = castingClass.detail.casting.classTag;
    const recorded = sheet.entries
      .filter(
        (row) =>
          row.kind === 'spell' &&
          !row.grantKey &&
          sheet.catalogEntries.some(
            (catalog) =>
              catalog._id === row.catalogEntryId &&
              catalog.ruleIdentity === definition.ruleIdentity,
          ) &&
          row.state.castingClassId === castingClass._id,
      )
      .at(-1);
    const selected =
      recorded && 'catalogEntryId' in recorded
        ? (sheet.catalogEntries.find(
            (catalog) => catalog._id === recorded.catalogEntryId,
          ) ?? definition)
        : definition;
    if (selected.detail.kind !== 'spell') continue;
    const levels = selected.detail.levels ?? {};
    const lowestLevel = Object.values(levels).length
      ? Math.min(...Object.values(levels))
      : null;
    const onList = Object.hasOwn(levels, classTag);
    const indexRow = {
      characterId: sheet.character._id,
      ruleIdentity: definition.ruleIdentity,
      levels,
      catalogEntryId: selected._id,
      castingClassId: castingClass._id,
      level: onList
        ? (levels[classTag] ?? null)
        : recorded?.state.kind === 'spell'
          ? (recorded.state.level ?? lowestLevel)
          : lowestLevel,
      school: selected.detail.school ?? '',
      name: selected.name,
      available: onList || Boolean(recorded),
      recorded: Boolean(recorded),
    };
    await ctx.db.insert('spellCatalogIndex', indexRow);
    await updateSpellCatalogSummary({ ctx, row: indexRow, delta: 1 });
  }
}

/** A casting copy has the same list facts; move its lightweight browser state. */
export async function reconcileCopiedSpellcasting({
  ctx,
  sheet,
  originalId,
  copyId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  originalId: Id<'catalogEntry'>;
  copyId: Id<'catalogEntry'>;
}) {
  const copy = sheet.catalogEntries.find((row) => row._id === copyId);
  if (copy?.detail.kind !== 'class') return;
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
      q.eq('characterId', sheet.character._id).eq('castingClassId', originalId),
    )
    .take(8193);
  if (rows.length > 8192)
    throw new ConvexError('Spellcasting catalog is too large to copy');
  for (const row of rows)
    await ctx.db.patch('spellCatalogIndex', row._id, {
      castingClassId: copyId,
    });
  const summaries = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q.eq('characterId', sheet.character._id).eq('castingClassId', originalId),
    )
    .take(257);
  if (summaries.length > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const row of summaries)
    await ctx.db.patch('spellCatalogSummary', row._id, {
      castingClassId: copyId,
    });
}

/** Remove one bounded chunk of a deleted Character's shared browser rows. */
export async function cleanupCharacterSpellIndex(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_ruleIdentity', (q) =>
      q.eq('characterId', characterId),
    )
    .take(64);
  for (const row of rows) {
    await updateSpellCatalogSummary({ ctx, row, delta: -1 });
    await ctx.db.delete('spellCatalogIndex', row._id);
  }
  return rows.length === 64;
}

/** Recalculate a changed list from indexed facts, without loading browse descriptions. */
export async function reconcileSpellcastingDefinition({
  ctx,
  sheet,
  catalogEntryId,
}: {
  ctx: MutationCtx;
  sheet: SpellCatalogSheet;
  catalogEntryId: Id<'catalogEntry'>;
}) {
  const definition = sheet.catalogEntries.find(
    (row) => row._id === catalogEntryId,
  );
  if (definition?.detail.kind !== 'class') return;
  const casting =
    'casting' in definition.detail ? definition.detail.casting : undefined;
  const rows = await ctx.db
    .query('spellCatalogIndex')
    .withIndex('by_characterId_and_castingClassId_and_name', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('castingClassId', catalogEntryId),
    )
    .take(8193);
  if (rows.length > 8192)
    throw new ConvexError('Spellcasting catalog is too large to edit');
  const summaries = await ctx.db
    .query('spellCatalogSummary')
    .withIndex('by_characterId_and_castingClassId_and_kind_and_value', (q) =>
      q
        .eq('characterId', sheet.character._id)
        .eq('castingClassId', catalogEntryId),
    )
    .take(257);
  if (summaries.length > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const row of summaries)
    await ctx.db.delete('spellCatalogSummary', row._id);
  const groups = new Map<
    string,
    WithoutSystemFields<Doc<'spellCatalogSummary'>>
  >();
  for (const row of rows) {
    const legacy =
      row.levels === undefined
        ? await ctx.db.get('catalogEntry', row.catalogEntryId)
        : null;
    const levels =
      row.levels ??
      (legacy?.detail.kind === 'spell' ? legacy.detail.levels : {}) ??
      {};
    const recorded = sheet.entries
      .filter(
        (entry) =>
          entry.kind === 'spell' &&
          !entry.grantKey &&
          entry.catalogEntryId === row.catalogEntryId &&
          entry.state.castingClassId === catalogEntryId,
      )
      .at(-1);
    const onList = Boolean(casting && Object.hasOwn(levels, casting.classTag));
    const lowest = Object.values(levels).length
      ? Math.min(...Object.values(levels))
      : null;
    const level =
      onList && casting
        ? (levels[casting.classTag] ?? null)
        : recorded?.state.kind === 'spell'
          ? (recorded.state.level ?? lowest)
          : lowest;
    const available = onList || Boolean(recorded);
    await ctx.db.patch('spellCatalogIndex', row._id, {
      levels,
      level,
      available,
      recorded: Boolean(recorded),
    });
    const values = [
      { kind: 'level', value: level },
      { kind: 'school', value: row.school },
    ] as const;
    for (const value of values) {
      const key = JSON.stringify(value);
      const previous = groups.get(key);
      groups.set(key, {
        ...value,
        characterId: sheet.character._id,
        castingClassId: catalogEntryId,
        count: (previous?.count ?? 0) + 1,
        availableCount: (previous?.availableCount ?? 0) + Number(available),
        unrecordedCount:
          (previous?.unrecordedCount ?? 0) + Number(available && !recorded),
      });
    }
  }
  if (groups.size > 256)
    throw new ConvexError('Spell catalog has too many levels or schools');
  for (const group of groups.values())
    await ctx.db.insert('spellCatalogSummary', group);
}
