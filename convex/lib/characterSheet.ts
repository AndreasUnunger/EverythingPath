import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  defaultAbilityScores,
} from '../../src/lib/character-sheet';
import { requireCharacterAccess, type CharacterScope } from './characterAccess';
import { updateCanonicalCharacter } from './canonicalCharacters';

const maxCharacterChildRows = 4096;

export function requireFixtureCampaign(campaign: Doc<'campaign'>) {
  if (!campaign.e2eFixture)
    throw new ConvexError(
      "Character sheets aren't available for this campaign yet.",
    );
}

export async function initializeCharacterSheet(
  ctx: MutationCtx,
  {
    characterId,
    operationId,
    updatedBy,
  }: { characterId: Id<'character'>; operationId: string; updatedBy: string },
) {
  const existing = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .first();
  if (existing) throw new ConvexError('Character already has a sheet');
  const catalogEntryId = await ctx.db.insert('catalogEntry', {
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: `base:${characterId}`,
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base',
      value: defaultAbilityScores[ability],
    })),
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'base',
    active: true,
    catalogEntryId,
    state: {
      kind: 'base',
    },
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'classLevel',
    active: true,
    state: {
      kind: 'classLevel',
      classEntryId: null,
      position: 1,
      hpGained: null,
    },
  });
  await ctx.db.patch('character', characterId, {
    sheetMode: 'full',
    sheetRevision: 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: updatedBy,
  });
}

export async function loadCharacterSheet(
  ctx: ReadCtx,
  args: CharacterScope,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const { character, campaign, user } = await requireCharacterAccess(ctx, args);
  if (isWritable) {
    if (campaign) {
      requireFixtureCampaign(campaign);
    } else if (!character.sheetDemo) {
      throw new ConvexError(
        "Editing isn't available for this character sheet yet.",
      );
    }
  }
  if (!character.sheetMode) return null;
  // Convex transaction limits bound this prepared sheet; overflow must not silently truncate it.
  const entries = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
    .take(maxCharacterChildRows + 1);
  if (entries.length > maxCharacterChildRows)
    throw new ConvexError('Character sheet is too large to load');
  const base = entries.find((entry) => entry.kind === 'base');
  const baseScoresEntry = base
    ? await ctx.db.get('catalogEntry', base.catalogEntryId)
    : null;
  if (baseScoresEntry?.characterId !== args.characterId)
    throw new ConvexError('Base scores do not belong to this Character');
  const catalogEntries = [baseScoresEntry];
  const calculated = calculateCharacterSheet({ entries, catalogEntries });
  const classLevels = entries
    .filter((entry) => entry.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
  return {
    character,
    entries: [
      ...entries.filter((entry) => entry.kind === 'base'),
      ...classLevels,
    ],
    catalogEntries,
    baseScoresEntry,
    calculated,
    revision: character.sheetRevision ?? 0,
    lastOperationId: character.sheetLastOperationId ?? null,
    updatedBy: character.sheetUpdatedBy ?? null,
    actor: user.tokenIdentifier,
  };
}

export async function recordSheetChange(
  ctx: MutationCtx,
  {
    character,
    operationId,
    updatedBy,
  }: { character: Doc<'character'>; operationId: string; updatedBy: string },
) {
  await ctx.db.patch('character', character._id, {
    sheetRevision: (character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: updatedBy,
  });
}

export async function updateCharacterArchive(
  ctx: MutationCtx,
  {
    characterId,
    isActive,
  }: { characterId: Id<'character'>; isActive: boolean },
) {
  await ctx.db.patch('character', characterId, { isActive });
  await updateCanonicalCharacter(ctx, characterId);
}

async function listRowsForDeletion<Row>(
  query: { take: (limit: number) => Promise<Row[]> },
  overflowMessage: string,
) {
  const rows = await query.take(maxCharacterChildRows + 1);
  if (rows.length > maxCharacterChildRows)
    throw new ConvexError(overflowMessage);
  return rows;
}

export async function deleteCharacterSheet(
  ctx: MutationCtx,
  characterId: Id<'character'>,
) {
  for (const table of ['characterSheetEntry', 'catalogEntry'] as const) {
    const rows = await listRowsForDeletion(
      ctx.db
        .query(table)
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
      'Character sheet is too large to delete',
    );
    for (const row of rows) await ctx.db.delete(table, row._id);
  }
  const spells = await listRowsForDeletion(
    ctx.db
      .query('characterSpell')
      .withIndex('characterId', (q) => q.eq('characterId', characterId)),
    'Character spell list is too large to delete',
  );
  for (const spell of spells) await ctx.db.delete('characterSpell', spell._id);
  await ctx.db.delete('character', characterId);
}
