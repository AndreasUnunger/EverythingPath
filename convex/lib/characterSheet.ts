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
import { requireCharacterCampaignAccess } from './characterAccess';

export async function requireSheetCampaignAccess(
  ctx: ReadCtx,
  {
    campaignId,
    organizationId,
  }: { campaignId: Id<'campaign'>; organizationId: string },
) {
  const result = await requireCharacterCampaignAccess(ctx, {
    campaignId,
    organizationId,
  });
  // Unlike the retired ledger fallback, new sheet APIs require actual membership.
  if (
    !result.access.user.orgIds.some(
      (membership) => membership.orgId === organizationId,
    )
  )
    throw new ConvexError('Campaign access required');
  return result;
}

export function requireFixtureCampaign(campaign: Doc<'campaign'>) {
  if (!campaign.e2eFixture)
    throw new ConvexError(
      'Character sheets are available only in fixture campaigns.',
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
  args: { characterId: Id<'character'>; organizationId: string },
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const character = await ctx.db.get('character', args.characterId);
  if (!character) throw new ConvexError('Character not found');
  const { campaign, access } = await requireSheetCampaignAccess(ctx, {
    campaignId: character.campaignId,
    organizationId: args.organizationId,
  });
  if (isWritable) requireFixtureCampaign(campaign);
  if (!character.sheetMode) return null;
  // Convex transaction limits bound this prepared sheet; overflow must not silently truncate it.
  const entries = await ctx.db
    .query('characterSheetEntry')
    .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
    .take(4097);
  if (entries.length > 4096)
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
    actor: access.user.tokenIdentifier,
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
