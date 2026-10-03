import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  abilityKeys,
  calculateCharacterSheet,
} from '../../src/lib/character-sheet';

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
  const catalogEntries: Doc<'catalogEntry'>[] = [baseScoresEntry];
  for (const entry of entries) {
    if (
      entry.kind === 'base' ||
      (entry.kind === 'classLevel' && entry.state.classEntryId === null)
    )
      continue;
    const definitionId =
      entry.kind === 'classLevel'
        ? entry.state.classEntryId
        : entry.catalogEntryId;
    const definition = definitions.find((row) => row._id === definitionId);
    const expectedKind = entry.kind === 'classLevel' ? 'class' : 'manual';
    if (
      definition?.characterId !== character._id ||
      definition.detail.kind !== expectedKind
    )
      throw new ConvexError(
        entry.kind === 'classLevel'
          ? 'Class definition does not belong to this Character'
          : 'Personal adjustment does not belong to this Character',
      );
    if (!catalogEntries.some((row) => row._id === definition._id))
      catalogEntries.push(definition);
  }
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: character.kind,
    sheetMode: character.sheetMode,
  });
  requireWholeCalculatedAbilities(calculated);
  const classLevels = entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
  return {
    character,
    entries: [
      ...entries.filter((entry) => entry.kind === 'base'),
      ...classLevels,
      ...entries.filter((entry) => entry.kind === 'manual'),
    ],
    catalogEntries,
    baseScoresEntry,
    calculated,
    acceptedWarnings,
    revision: character.sheetRevision ?? 0,
    lastOperationId: character.sheetLastOperationId ?? null,
    updatedBy: character.sheetUpdatedBy ?? null,
  };
}
