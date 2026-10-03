import {
  listCatalogReferences,
  type CatalogReference,
} from '../../src/lib/catalog-copy-references';
import {
  readReferencedCatalogDefinitions,
  type CatalogLoadReference,
} from './catalogCopies';
import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
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
  additionalReferences: CatalogLoadReference[] = [],
) {
  await requireCompatibleActiveRelease(ctx);
  const [entries, localDefinitions, acceptedWarnings] = await Promise.all([
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
    localDefinitions.length > maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large to load');
  const definitions = await readReferencedCatalogDefinitions(
    ctx,
    character,
    localDefinitions,
    [
      ...entries.flatMap((entry) =>
        listCatalogReferences(entry).map((reference) => ({
          ...reference,
          refusalMessage:
            reference.kind === 'class'
              ? 'Class does not belong to this Character'
              : entry.kind === 'base'
                ? 'Base scores do not belong to this Character'
                : entry.kind === 'manual'
                  ? 'Personal adjustment does not belong to this Character'
                  : 'Catalog Entry does not belong to this Character',
        })),
      ),
      ...additionalReferences,
    ],
  );
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
    if (local) throw new ConvexError(message);
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

export type CatalogDependency = CatalogReference;

/** Every catalog reference, including future Grants and modifier conditions. */
export function listCatalogDependencies(
  definition: Doc<'catalogEntry'>,
): CatalogDependency[] {
  return listCatalogReferences(definition);
}
