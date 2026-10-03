import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  abilityKeys,
  type calculateCharacterSheet,
} from '../../src/lib/character-sheet';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';

function isBaseCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'base' } }> {
  return entry.detail.kind === 'base';
}

export async function loadPreparedCharacterSheet(
  ctx: ReadCtx,
  character: Doc<'character'>,
  campaign?: Doc<'campaign'>,
) {
  if (!character.sheetMode) return null;
  const currentCampaign =
    campaign ??
    (character.campaignId
      ? await ctx.db.get('campaign', character.campaignId)
      : null);
  if (!currentCampaign?.e2eFixture) return null;
  return await readCharacterSheetData(ctx, character);
}

export function requireAbilityScore(score: number) {
  if (!Number.isFinite(score))
    throw new ConvexError('Enter finite ability scores');
  if (!Number.isSafeInteger(score))
    throw new ConvexError('Enter whole ability scores');
}

export function requireWholeCalculatedAbilities(
  calculated: ReturnType<typeof calculateCharacterSheet>,
) {
  for (const ability of abilityKeys)
    requireAbilityScore(calculated.abilities[ability].score);
}

export const maxCharacterChildRows = 4096;
export const maxAcceptedWarnings = 8192;
export const maxPreparedCharacters = 256;

export async function loadPreparedCharacterSheets(
  ctx: ReadCtx,
  characters: readonly Doc<'character'>[],
  campaign: Doc<'campaign'>,
) {
  const prepared = characters.filter(
    (character) => character.sheetMode && campaign.e2eFixture,
  );
  if (prepared.length > maxPreparedCharacters)
    throw new ConvexError('This campaign exceeds the prepared Character limit');
  return await Promise.all(
    characters.map((character) =>
      loadPreparedCharacterSheet(ctx, character, campaign),
    ),
  );
}

export async function readCharacterSheetData(
  ctx: ReadCtx,
  character: Doc<'character'>,
) {
  await requireCompatibleActiveRelease(ctx);
  const [entries, definitions, acceptedWarnings] = await Promise.all([
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
      .take(maxCharacterChildRows + 1),
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
      .take(maxCharacterChildRows + 1),
    ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', character._id))
      .take(maxAcceptedWarnings + 1),
  ]);
  if (
    entries.length > maxCharacterChildRows ||
    definitions.length > maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large to load');
  if (acceptedWarnings.length > maxAcceptedWarnings)
    throw new ConvexError('Character has too many accepted warnings');
  const base = entries.find((entry) => entry.kind === 'base');
  const baseScoresEntry = base
    ? definitions.find((entry) => entry._id === base.catalogEntryId)
    : null;
  if (
    baseScoresEntry?.characterId !== character._id ||
    !isBaseCatalogEntry(baseScoresEntry)
  )
    throw new ConvexError('Base scores do not belong to this Character');
  // Recorded state and future Grants both depend on local catalog definitions.
  // Validate the complete prepared catalog, including untouched nested grants.
  const catalogEntries: Doc<'catalogEntry'>[] = [...definitions];
  const definitionsById = new Map<string, Doc<'catalogEntry'>>(
    definitions.map((row) => [row._id, row]),
  );
  const dependencies = definitions.flatMap(listCatalogDependencies);
  const classIds = [
    ...(base?.state.favoredClassIds ?? []),
    ...entries.flatMap((entry) =>
      entry.kind === 'classLevel' && entry.state.classEntryId
        ? [entry.state.classEntryId]
        : [],
    ),
  ];
  const missingIds = [
    ...new Set([
      ...dependencies
        .filter(({ kind }) => kind !== 'definition')
        .map(({ id }) => id),
      ...classIds,
    ]),
  ].filter((id) => !definitionsById.has(id));
  const missingDefinitions = new Map(
    await Promise.all(
      missingIds.map(async (id) => {
        const catalogEntryId = ctx.db.normalizeId('catalogEntry', id);
        if (!catalogEntryId)
          throw new ConvexError(
            'Catalog dependency does not belong to this Character',
          );
        return [id, await ctx.db.get('catalogEntry', catalogEntryId)] as const;
      }),
    ),
  );
  function requireDefinition(id: string, message: string) {
    const definition = definitionsById.get(id);
    if (!definition) throw new ConvexError(message);
    return definition;
  }
  function readClassDefinition(
    classEntryId: string,
    message = 'Class does not belong to this Character',
  ) {
    const local = definitionsById.get(classEntryId);
    if (local?.detail.kind === 'class') return local;
    // Missing definitions remain Unspecified. Existing foreign references fail.
    if (local || missingDefinitions.get(classEntryId))
      throw new ConvexError(message);
    return null;
  }
  for (const { id, kind } of dependencies) {
    if (kind === 'definition')
      requireDefinition(
        id,
        'Catalog dependency does not belong to this Character',
      );
    else if (kind === 'class')
      readClassDefinition(
        id,
        'Class counterpart does not belong to this Character',
      );
    else if (!definitionsById.has(id) && missingDefinitions.get(id))
      throw new ConvexError(
        'Catalog dependency does not belong to this Character',
      );
  }
  for (const classId of base?.state.favoredClassIds ?? [])
    readClassDefinition(classId);
  for (const entry of entries) {
    if (
      entry.kind === 'base' ||
      entry.kind === 'abilityDamage' ||
      entry.kind === 'abilityDrain'
    )
      continue;
    if (entry.kind === 'classLevel') {
      if (entry.state.classEntryId !== null)
        readClassDefinition(entry.state.classEntryId);
      continue;
    }
    const definition = requireDefinition(
      entry.catalogEntryId,
      entry.kind === 'manual'
        ? 'Personal adjustment does not belong to this Character'
        : 'Catalog Entry does not belong to this Character',
    );
    if (definition.detail.kind !== entry.kind)
      throw new ConvexError('Catalog Entry does not match this sheet entry');
  }
  const { current: calculated, permanent } = calculateActiveCharacterSheet({
    entries,
    catalogEntries,
    characterKind: character.kind,
    sheetMode: character.sheetMode,
  });
  requireWholeCalculatedAbilities(calculated);
  requireWholeCalculatedAbilities(permanent);
  const { resolvedEntries: _resolvedEntries, ...permanentCalculated } =
    permanent;
  const classLevels = entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
  return {
    character,
    entries: [
      ...entries.filter((entry) => entry.kind === 'base'),
      ...classLevels,
      ...entries.filter(
        (entry) => entry.kind !== 'base' && entry.kind !== 'classLevel',
      ),
    ],
    catalogEntries,
    baseScoresEntry,
    calculated,
    permanentCalculated,
    acceptedWarnings,
    revision: character.sheetRevision ?? 0,
    lastOperationId: character.sheetLastOperationId ?? null,
    updatedBy: character.sheetUpdatedBy ?? null,
  };
}

export type CatalogDependency = {
  id: string;
  kind: 'definition' | 'class' | 'condition';
};

/** Every catalog reference, including future Grants and modifier conditions. */
export function listCatalogDependencies(
  definition: Doc<'catalogEntry'>,
): CatalogDependency[] {
  const dependencies: CatalogDependency[] = (definition.grants ?? []).map(
    ({ catalogEntryId }) => ({ id: catalogEntryId, kind: 'definition' }),
  );
  for (const slot of definition.grantsSlots ?? [])
    for (const id of slot.feats ?? [])
      dependencies.push({ id, kind: 'definition' });
  for (const modifier of definition.modifiers) {
    if (!('condition' in modifier) || !modifier.condition) continue;
    const { whileActive, situation } = modifier.condition;
    if (whileActive) dependencies.push({ id: whileActive, kind: 'condition' });
    if (typeof situation === 'object' && 'option' in situation)
      dependencies.push({ id: situation.option, kind: 'condition' });
  }
  const detail = definition.detail;
  const add = (ids: readonly Id<'catalogEntry'>[]) =>
    dependencies.push(
      ...ids.map((id) => ({ id, kind: 'definition' as const })),
    );
  if (detail.kind === 'class') {
    if ('counterpartOf' in detail && detail.counterpartOf)
      dependencies.push({ id: detail.counterpartOf, kind: 'class' });
    if ('featuresByLevel' in detail)
      add(detail.featuresByLevel.map((feature) => feature.catalogEntryId));
  } else if (detail.kind === 'race') add(detail.racialTraits);
  else if (detail.kind === 'racialTrait')
    add([...detail.raceEntryIds, ...detail.replaces]);
  else if (detail.kind === 'archetype')
    add([
      ...detail.classEntryIds,
      ...detail.adds.map((feature) => feature.catalogEntryId),
      ...detail.replaces.map((feature) => feature.catalogEntryId),
    ]);
  return dependencies;
}
