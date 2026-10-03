import { resolveCharacterSheetGrants } from '../../src/lib/character-sheet-grants';
import { ConvexError } from 'convex/values';
import {
  representativeRaceCatalog,
  materializeRepresentativeRaceCatalog,
} from './representativeRaceCatalog';
import { representativeClassCatalog } from './representativeClassCatalog';
import {
  getCompanionSupportingEntryKeys,
  reconcileCompanionRelationships,
} from './companionRelationships';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { ReadCtx } from '../types';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
  defaultCreationSettings,
  type AbilityScores,
} from '../../src/lib/character-sheet';
import { requireCharacterAccess, type CharacterScope } from './characterAccess';
import { updateCanonicalCharacter } from './canonicalCharacters';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';
import {
  readCharacterSheetData,
  maxCharacterChildRows,
  maxAcceptedWarnings,
  requireAbilityScore,
  requireWholeCalculatedAbilities,
} from './preparedCharacterSheet';

export function isManualCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'manual' } }> {
  return entry.detail.kind === 'manual';
}

export function requireFixtureCampaign(
  campaign: Doc<'campaign'>,
  message = "Character sheets aren't available for this campaign yet.",
) {
  if (!campaign.e2eFixture) throw new ConvexError(message);
}

export function requireCharacterLevel(level: number) {
  if (!Number.isInteger(level) || level < 0 || level >= maxCharacterChildRows)
    throw new ConvexError(
      `Enter a whole level between 0 and ${maxCharacterChildRows - 1}`,
    );
}

export async function insertClassLevel(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  position: number,
) {
  const entryId = await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'classLevel',
    active: true,
    state: { kind: 'classLevel', classEntryId: null, position, hpGained: null },
  });
  const entry = await ctx.db.get('characterSheetEntry', entryId);
  if (entry?.kind !== 'classLevel')
    throw new ConvexError('Class Level is unavailable');
  return entry;
}

export async function initializeCharacterSheet(
  ctx: MutationCtx,
  {
    characterId,
    operationId,
    updatedBy,
    sheetMode = 'full',
    level = 1,
    scores = defaultAbilityScores,
  }: {
    characterId: Id<'character'>;
    operationId: string;
    updatedBy: string;
    sheetMode?: 'militiaOnly' | 'full';
    level?: number;
    scores?: AbilityScores;
  },
) {
  requireCharacterLevel(level);
  for (const ability of abilityKeys) requireAbilityScore(scores[ability]);
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
      value: scores[ability],
    })),
  });
  await ctx.db.insert('characterSheetEntry', {
    characterId,
    kind: 'base',
    active: true,
    catalogEntryId,
    state: {
      kind: 'base',
      ...defaultCreationSettings,
    },
  });
  // Isolated prepared sheets carry representative classes, not a Catalog Release.
  for (const definition of representativeClassCatalog) {
    await ctx.db.insert('catalogEntry', {
      ...definition,
      characterId,
      scope: 'character',
    });
  }
  const raceCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeRaceCatalog) {
    const id = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: definition.name ?? definition._id,
      ruleIdentity: definition.ruleIdentity,
      stacksWithItself: false,
      sources: definition.sources,
      modifiers: [],
      detail: { kind: 'manual' },
    });
    raceCatalogIds.set(definition._id, id);
  }
  for (const { key, definition } of materializeRepresentativeRaceCatalog(
    (key) => {
      const id = raceCatalogIds.get(key);
      if (!id)
        throw new ConvexError('Representative race reference is unavailable');
      return id;
    },
  )) {
    const id = raceCatalogIds.get(key);
    if (!id) throw new ConvexError('Representative race is unavailable');
    await ctx.db.replace('catalogEntry', id, {
      ...definition,
      scope: 'character',
      characterId,
    });
  }
  for (let position = 1; position <= level; position++)
    await insertClassLevel(ctx, characterId, position);
  await ctx.db.patch('character', characterId, {
    sheetMode,
    sheetRevision: 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: updatedBy,
  });
  await updateCanonicalCharacter(ctx, characterId);
}

export async function loadCharacterSheet(
  ctx: ReadCtx,
  args: CharacterScope,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const access = await requireCharacterAccess(ctx, args);
  return await loadCharacterSheetFromAccess(ctx, access, { isWritable });
}

export async function loadCharacterSheetFromAccess(
  ctx: ReadCtx,
  {
    character,
    campaign,
    user,
  }: Awaited<ReturnType<typeof requireCharacterAccess>>,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
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
  const data = await readCharacterSheetData(ctx, character);
  return {
    ...data,
    initialSupportingEntryKeys: getCompanionSupportingEntryKeys(data),
    campaign: campaign
      ? {
          campaignId: campaign._id,
          campaignName: campaign.name,
          organizationId: campaign.organizationId,
          ownershipAvailable: Boolean(campaign.e2eFixture),
        }
      : null,
    actor: user.tokenIdentifier,
  };
}

export type LoadedCharacterSheet = NonNullable<
  Awaited<ReturnType<typeof loadCharacterSheet>>
>;

// The in-memory sheet must reflect the pending write before pruning acceptances.
export async function pruneWarningAcceptancesAndRecordChange(
  ctx: MutationCtx,
  {
    sheet,
    operationId,
  }: {
    sheet: LoadedCharacterSheet;
    operationId: string;
  },
) {
  await requireCompatibleActiveRelease(ctx);
  const { current: calculated, permanent } = calculateActiveCharacterSheet({
    entries: sheet.entries,
    catalogEntries: sheet.catalogEntries,
    characterKind: sheet.character.kind,
    sheetMode: sheet.character.sheetMode,
  });
  requireWholeCalculatedAbilities(calculated);
  requireWholeCalculatedAbilities(permanent);
  const availableGrantIds = resolveCharacterSheetGrants({
    entries: sheet.entries,
    catalogEntries: sheet.catalogEntries,
    characterKind: sheet.character.kind,
  })
    .allEntries.filter((row) => row.origin === 'grant')
    .map((row) => row.entry._id);
  for (const accepted of sheet.acceptedWarnings) {
    const stillApplies = calculated.warningsForAcceptance.some(
      (warning) =>
        warning.kind === 'rules' &&
        warning.check === accepted.check &&
        warning.subject === accepted.subject &&
        warning.fingerprint === accepted.fingerprint,
    );
    // No row is needed for an untouched Grant's warning acceptance. Its facts
    // are checked again when the absent source returns.
    const absentGrant =
      accepted.subject.startsWith('grant:') &&
      !availableGrantIds.some(
        (id) =>
          accepted.subject === id || accepted.subject.startsWith(`${id}:`),
      );
    if (!stillApplies && !absentGrant)
      await ctx.db.delete('acceptedWarning', accepted._id);
  }
  await ctx.db.patch('character', sheet.character._id, {
    sheetRevision: (sheet.character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: sheet.actor,
  });
  await updateCanonicalCharacter(ctx, sheet.character._id);
  sheet.calculated = calculated;
  await reconcileCompanionRelationships(
    ctx,
    sheet.character._id,
    operationId,
    [sheet],
    sheet.initialSupportingEntryKeys,
  );
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
  await reconcileCompanionRelationships(ctx, characterId);
}

async function listRowsForDeletion<Row>(
  query: { take: (limit: number) => Promise<Row[]> },
  overflowMessage: string,
  limit = maxCharacterChildRows,
) {
  const rows = await query.take(limit + 1);
  if (rows.length > limit) throw new ConvexError(overflowMessage);
  return rows;
}

export async function deleteCharacterSheet(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  operationId?: string,
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
  const acceptedWarnings = await listRowsForDeletion(
    ctx.db
      .query('acceptedWarning')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character has too many accepted warnings',
    maxAcceptedWarnings,
  );
  for (const warning of acceptedWarnings)
    await ctx.db.delete('acceptedWarning', warning._id);
  const spells = await listRowsForDeletion(
    ctx.db
      .query('characterSpell')
      .withIndex('characterId', (q) => q.eq('characterId', characterId)),
    'Character spell list is too large to delete',
  );
  for (const spell of spells) await ctx.db.delete('characterSpell', spell._id);
  await ctx.db.delete('character', characterId);
  await reconcileCompanionRelationships(ctx, characterId, operationId);
}
