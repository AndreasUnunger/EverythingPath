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
import { jsonBytes } from '../../src/lib/json-bytes';
import {
  abilityKeys,
  type calculateCharacterSheet,
} from '../../src/lib/character-sheet';
import {
  calculateActiveCharacterSheet,
  readCompatibleActiveRelease,
} from './catalogReleaseCompatibility';

function isBaseCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'base' } }> {
  return entry.detail.kind === 'base';
}

export function requireAbilityScore(score: number) {
  if (!Number.isFinite(score))
    throw new ConvexError('Enter finite ability scores');
  if (!Number.isSafeInteger(score))
    throw new ConvexError('Enter whole ability scores');
}

export function requireWholeCalculatedAbilities(
  calculated: Pick<ReturnType<typeof calculateCharacterSheet>, 'abilities'>,
) {
  for (const ability of abilityKeys)
    requireAbilityScore(calculated.abilities[ability].score);
}

export const maxCharacterChildRows = 4096;
export const maxAcceptedWarnings = 8192;
export const maxPreparedCharacters = 256;

export type CharacterSheetReadOptions = {
  trustedLinkedInputs?: boolean;
  resourceLimits?: {
    maximumTotalBytesRead: number;
    maximumReferences: number;
  };
  includeAcceptedWarnings?: boolean;
};

export function createReadBudget(
  resourceLimits: CharacterSheetReadOptions['resourceLimits'],
) {
  let totalBytesRead = 0;
  const externalReferences = new Set<string>();
  return {
    accountRead(value: unknown) {
      if (!resourceLimits) return;
      totalBytesRead += jsonBytes(value);
      if (totalBytesRead > resourceLimits.maximumTotalBytesRead)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill read resource limit',
        );
    },
    accountReference(id: string) {
      if (!resourceLimits) return;
      externalReferences.add(id);
      if (externalReferences.size > resourceLimits.maximumReferences)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill reference resource limit',
        );
    },
  };
}

export async function readCharacterSheetData(
  ctx: ReadCtx,
  character: Doc<'character'>,
  referencesOrOptions: CatalogLoadReference[] | CharacterSheetReadOptions = [],
  options: CharacterSheetReadOptions = {},
) {
  const additionalReferences = Array.isArray(referencesOrOptions)
    ? referencesOrOptions
    : [];
  const readOptions = Array.isArray(referencesOrOptions)
    ? options
    : referencesOrOptions;
  return await readCharacterSheetDataWithBudget(
    ctx,
    character,
    additionalReferences,
    readOptions,
    createReadBudget(readOptions.resourceLimits),
  );
}

export async function readCharacterSheetDataWithBudget(
  ctx: ReadCtx,
  character: Doc<'character'>,
  additionalReferences: CatalogLoadReference[],
  { resourceLimits, includeAcceptedWarnings = true }: CharacterSheetReadOptions,
  readBudget: ReturnType<typeof createReadBudget>,
) {
  const { control: activeRelease, calculationIdentity } =
    await readCompatibleActiveRelease(ctx);
  readBudget.accountRead(activeRelease);
  async function readRows<T>(
    query: AsyncIterable<T> & { take(count: number): Promise<T[]> },
    maximumRows: number,
  ) {
    if (!resourceLimits) return await query.take(maximumRows + 1);
    const rows: T[] = [];
    for await (const row of query) {
      readBudget.accountRead(row);
      if (rows.length >= maximumRows)
        throw new ConvexError(
          'Recorded sheet exceeds the backfill read resource limit',
        );
      rows.push(row);
    }
    return rows;
  }
  const entries = await readRows(
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', character._id)),
    maxCharacterChildRows,
  );
  const localDefinitions = await readRows(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', character._id).eq('browseOnly', undefined),
      ),
    maxCharacterChildRows,
  );
  const acceptedWarnings = includeAcceptedWarnings
    ? await readRows(
        ctx.db
          .query('acceptedWarning')
          .withIndex('by_characterId', (q) =>
            q.eq('characterId', character._id),
          ),
        maxAcceptedWarnings,
      )
    : [];
  if (
    entries.length > maxCharacterChildRows ||
    localDefinitions.length > maxCharacterChildRows
  )
    throw new ConvexError('Character sheet is too large to load');
  const referencedDefinitions = await readReferencedCatalogDefinitions(
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
              : entry.kind === 'archetype' &&
                  entry.state.replaces?.some(
                    (replacement) =>
                      replacement.catalogEntryId === reference.id,
                  )
                ? 'Replacement feature does not belong to this Character'
                : entry.kind === 'base'
                  ? 'Base scores do not belong to this Character'
                  : entry.kind === 'manual'
                    ? 'Personal adjustment does not belong to this Character'
                    : 'Catalog Entry does not belong to this Character',
        })),
      ),
      ...additionalReferences,
    ],
    readBudget,
  );
  const requiredSpellIdentities = new Set<string>();
  function collectRequiredSpells(
    requirement: NonNullable<Doc<'catalogEntry'>['prerequisites']>[number],
  ) {
    if ('anyOf' in requirement) {
      for (const alternative of requirement.anyOf)
        collectRequiredSpells(alternative);
    } else if ('castsSpell' in requirement) {
      requiredSpellIdentities.add(requirement.castsSpell);
    }
  }
  for (const definition of referencedDefinitions)
    for (const requirement of definition.prerequisites ?? [])
      collectRequiredSpells(requirement);
  if (requiredSpellIdentities.size > maxCharacterChildRows)
    throw new ConvexError('Character has too many required Spells');
  const spellReferences: CatalogLoadReference[] = [];
  for (const identity of requiredSpellIdentities) {
    if (
      referencedDefinitions.some(
        (definition) => definition.ruleIdentity === identity,
      )
    )
      continue;
    const spellRows = await readRows(
      ctx.db
        .query('spellCatalogIndex')
        .withIndex('by_characterId_and_ruleIdentity', (q) =>
          q.eq('characterId', character._id).eq('ruleIdentity', identity),
        ),
      64,
    );
    if (spellRows.length > 64)
      throw new ConvexError('Spell has too many casting lists');
    for (const row of spellRows)
      spellReferences.push({
        id: row.catalogEntryId,
        kind: 'definition',
        refusalMessage: 'Spell does not belong to this Character',
      });
  }
  const definitions = spellReferences.length
    ? await readReferencedCatalogDefinitions(
        ctx,
        character,
        referencedDefinitions,
        spellReferences,
        readBudget,
      )
    : referencedDefinitions;
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
    if (entry.kind === 'attackRoutine') {
      const weaponIds = [entry.state.weaponEntryId];
      if (entry.state.offHand?.kind === 'weapon')
        weaponIds.push(entry.state.offHand.weaponEntryId);
      for (const weaponId of weaponIds) {
        let weapon = entries.find((row) => row._id === weaponId);
        if (!weapon) {
          readBudget.accountReference(weaponId);
          weapon =
            (await ctx.db.get('characterSheetEntry', weaponId)) ?? undefined;
          readBudget.accountRead(weapon ?? null);
        }
        if (weapon && weapon.characterId !== character._id)
          throw new ConvexError('Weapon does not belong to this Character');
      }
      continue;
    }
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
    if (entry.kind === 'spell' && entry.state.castingClassId)
      readClassDefinition(entry.state.castingClassId);
    if (entry.kind === 'archetype') {
      if (entry.state.classEntryId)
        readClassDefinition(entry.state.classEntryId);
      for (const replacement of entry.state.replaces ?? []) {
        const target = requireDefinition(
          replacement.catalogEntryId,
          'Replacement feature does not belong to this Character',
        );
        if (target.detail.kind !== 'classFeature')
          throw new ConvexError('Choose a class feature to replace');
      }
    }
  }
  const { current: calculated, permanent } = calculateActiveCharacterSheet(
    {
      entries,
      catalogEntries,
      characterKind: character.kind,
      sheetMode: character.sheetMode,
      familiarBaseCreatureKey: character.familiarBaseCreatureKey,
    },
    calculationIdentity,
  );
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
    permanentResolvedEntries: permanent.resolvedEntries,
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
