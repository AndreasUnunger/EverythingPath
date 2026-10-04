import {
  projectCampaignCopies,
  type CatalogLoadReference,
} from './catalogCopies';
import { getCompanionSupportingEntryKeys } from './companionRelationshipGraph';
import { markCatalogImpactDirty } from './catalogReleaseImpact';
import { listCatalogReferences } from '../../src/lib/catalog-copy-references';
import { resolveCharacterSheetGrants } from '../../src/lib/character-sheet-grants';
import { ConvexError } from 'convex/values';
import {
  representativeRaceCatalog,
  materializeRepresentativeRaceCatalog,
} from './representativeRaceCatalog';
import {
  representativeClassCatalog,
  materializeRepresentativeClassDetail,
} from './representativeClassCatalog';
import { representativeSpellCatalog } from './representativeSpellCatalog';
import { installPreparedSpells } from './spellCatalogInstall';
import {
  representativeArchetypeCatalog,
  materializeRepresentativeArchetypeCatalog,
} from './representativeArchetypeCatalog';
import { representativeWeaponCatalog } from './representativeWeaponCatalog';
import { representativeSelectionCatalog } from './representativeSelectionCatalog';
import { reconcileCompanionRelationships } from './companionRelationships';
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
  cleanupCharacterSpellIndex,
  deleteSpellCatalogIndex,
} from './spellCatalog';
import { internal } from '../_generated/api';
import { requireCompatibleActiveRelease } from './catalogReleaseCompatibility';
import { applyFamiliarToSheet } from './characterSheetFamiliar';
import {
  readCharacterSheetData,
  maxCharacterChildRows,
  maxAcceptedWarnings,
  requireAbilityScore,
  requireWholeCalculatedAbilities,
} from './characterSheetData';

export function isManualCatalogEntry(
  entry: Doc<'catalogEntry'>,
): entry is Extract<Doc<'catalogEntry'>, { detail: { kind: 'manual' } }> {
  return entry.detail.kind === 'manual';
}

const seededRuleIdentities = new Set<string>(
  [
    ...representativeSelectionCatalog,
    ...representativeClassCatalog,
    ...representativeArchetypeCatalog,
    ...representativeWeaponCatalog,
    ...representativeRaceCatalog,
  ].map((definition) => definition.ruleIdentity),
);

/** Rows every new sheet seeds; they outlive any entry that references them. */
export function isSeededCatalogEntry(entry: Doc<'catalogEntry'>) {
  return (
    entry.scope === 'character' &&
    entry.copiedFrom === undefined &&
    seededRuleIdentities.has(entry.ruleIdentity)
  );
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
  const selectionCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeSelectionCatalog) {
    const id = await ctx.db.insert('catalogEntry', {
      ...definition,
      characterId,
      scope: 'character',
    });
    selectionCatalogIds.set(definition.ruleIdentity, id);
  }
  const classCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeClassCatalog) {
    const id = await ctx.db.insert('catalogEntry', {
      ...definition,
      characterId,
      scope: 'character',
    });
    classCatalogIds.set(definition.ruleIdentity, id);
  }
  const archetypeCatalogIds = new Map([
    ...selectionCatalogIds,
    ...classCatalogIds,
  ]);
  for (const definition of representativeArchetypeCatalog) {
    const id = await ctx.db.insert('catalogEntry', {
      scope: 'character',
      characterId,
      name: definition.name ?? definition._id,
      ruleIdentity: definition.ruleIdentity,
      sources: definition.sources,
      modifiers: [],
      stacksWithItself: false,
      detail: { kind: 'manual' },
    });
    archetypeCatalogIds.set(definition._id, id);
  }
  const idForArchetypeKey = (key: string) => {
    const id = archetypeCatalogIds.get(key);
    if (!id)
      throw new ConvexError(
        'Representative archetype reference is unavailable',
      );
    return id;
  };
  for (const { key, definition } of materializeRepresentativeArchetypeCatalog(
    idForArchetypeKey,
  ))
    await ctx.db.replace('catalogEntry', idForArchetypeKey(key), {
      ...definition,
      scope: 'character',
      characterId,
    });
  for (const definition of representativeClassCatalog)
    await ctx.db.patch(
      'catalogEntry',
      idForArchetypeKey(definition.ruleIdentity),
      {
        detail: materializeRepresentativeClassDetail(
          definition.ruleIdentity,
          idForArchetypeKey,
        ),
      },
    );
  for (const definition of representativeWeaponCatalog) {
    const { otherEnd, ...primaryEnd } = {
      ...definition.detail.weapon,
      otherEnd:
        'otherEnd' in definition.detail.weapon
          ? definition.detail.weapon.otherEnd
          : undefined,
    };
    await ctx.db.insert('catalogEntry', {
      ...definition,
      sources: definition.sources.map((source) => ({ ...source })),
      modifiers: [...definition.modifiers],
      detail: {
        ...definition.detail,
        weapon: {
          ...primaryEnd,
          damageTypes: [...primaryEnd.damageTypes],
          ...(otherEnd
            ? {
                otherEnd: {
                  ...otherEnd,
                  damageTypes: [...otherEnd.damageTypes],
                },
              }
            : {}),
        },
      },
      characterId,
      scope: 'character',
      stacksWithItself: false,
    });
  }
  const raceCatalogIds = new Map<string, Id<'catalogEntry'>>();
  for (const definition of representativeRaceCatalog) {
    const existing = selectionCatalogIds.get(definition.ruleIdentity);
    if (existing) {
      raceCatalogIds.set(definition._id, existing);
      continue;
    }
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
    if (selectionCatalogIds.has(definition.ruleIdentity)) continue;
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
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new ConvexError('Character not found');
  const campaign = character.campaignId
    ? await ctx.db.get('campaign', character.campaignId)
    : null;
  if (campaign?.e2eFixture || (!character.campaignId && character.sheetDemo)) {
    const sheet = await readCharacterSheetData(ctx, character);
    for (
      let offset = 0;
      offset < representativeSpellCatalog.length;
      offset += 64
    )
      await installPreparedSpells({
        ctx,
        sheet,
        spells: representativeSpellCatalog.slice(offset, offset + 64),
      });
  }
  await updateCanonicalCharacter(ctx, characterId);
}

export async function loadCharacterSheet(
  ctx: ReadCtx,
  args: CharacterScope,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const access = await requireCharacterAccess(ctx, args);
  return await loadCharacterSheetFromAccess(ctx, access, {
    isWritable,
    additionalReferences: listCatalogReferences(args).map((reference) => ({
      ...reference,
      refusalMessage:
        reference.kind === 'condition'
          ? 'Modifier reference does not belong to this Character'
          : reference.kind === 'class'
            ? 'Class does not belong to this Character'
            : 'Catalog Entry does not belong to this Character',
    })),
  });
}

export async function loadCharacterSheetFromAccess(
  ctx: ReadCtx,
  {
    character,
    campaign,
    user,
  }: Awaited<ReturnType<typeof requireCharacterAccess>>,
  {
    isWritable = false,
    additionalReferences = [],
  }: {
    isWritable?: boolean;
    additionalReferences?: CatalogLoadReference[];
  } = {},
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
  const data = await readCharacterSheetData(
    ctx,
    character,
    additionalReferences,
  );
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
  const calculationIdentity = await requireCompatibleActiveRelease(ctx);
  const catalogEntries = projectCampaignCopies(sheet.catalogEntries);
  const projected = await applyFamiliarToSheet(
    ctx,
    { ...sheet, catalogEntries },
    { trustedLinkedInputs: true, recalculate: true, calculationIdentity },
  );
  const calculated = projected.calculated;
  const permanent = projected.permanentCalculated;
  requireWholeCalculatedAbilities(calculated);
  requireWholeCalculatedAbilities(permanent);
  const availableGrantIds = resolveCharacterSheetGrants({
    entries: sheet.entries,
    catalogEntries,
    characterKind: sheet.character.kind,
  })
    .allEntries.filter((row) => row.origin === 'grant')
    .map((row) => row.entry._id);
  const removedAcceptanceIds = new Set<Id<'acceptedWarning'>>();
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
    if (!stillApplies && !absentGrant) {
      await ctx.db.delete('acceptedWarning', accepted._id);
      removedAcceptanceIds.add(accepted._id);
    }
  }
  sheet.acceptedWarnings = sheet.acceptedWarnings.filter(
    (accepted) => !removedAcceptanceIds.has(accepted._id),
  );
  await ctx.db.patch('character', sheet.character._id, {
    sheetRevision: (sheet.character.sheetRevision ?? 0) + 1,
    sheetLastOperationId: operationId,
    sheetUpdatedBy: sheet.actor,
  });
  const permanentCalculated = permanent;
  await updateCanonicalCharacter(ctx, sheet.character._id, {
    permanentCalculated,
  });
  sheet.calculated = calculated;
  sheet.permanentCalculated = permanentCalculated;
  sheet.permanentResolvedEntries = projected.permanentResolvedEntries;
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
  const entries = await listRowsForDeletion(
    ctx.db
      .query('characterSheetEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character sheet is too large to delete',
  );
  for (const entry of entries)
    await ctx.db.delete('characterSheetEntry', entry._id);
  const definitions = await listRowsForDeletion(
    ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId_and_browseOnly', (q) =>
        q.eq('characterId', characterId).eq('browseOnly', undefined),
      ),
    'Character sheet is too large to delete',
  );
  for (const definition of definitions) {
    await deleteSpellCatalogIndex(ctx, definition._id);
    await ctx.db.delete('catalogEntry', definition._id);
  }
  const linkedInputs = await listRowsForDeletion(
    ctx.db
      .query('characterLinkedInput')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId)),
    'Character sheet is too large to delete',
  );
  for (const row of linkedInputs)
    await ctx.db.delete('characterLinkedInput', row._id);
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
  await markCatalogImpactDirty(ctx, characterId);
  await ctx.db.delete('character', characterId);
  const pendingMove = await ctx.db
    .query('characterMove')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .first();
  if (pendingMove)
    await ctx.scheduler.runAfter(0, internal.characterMoves.cleanup, {
      characterId,
    });
  if (await cleanupCharacterSpellIndex(ctx, characterId))
    await ctx.scheduler.runAfter(
      0,
      internal.characterSheetSpells.cleanupCatalog,
      { characterId },
    );
  const browseCatalog = await ctx.db
    .query('catalogEntry')
    .withIndex('by_characterId_and_browseOnly', (q) =>
      q.eq('characterId', characterId).eq('browseOnly', true),
    )
    .take(33);
  if (browseCatalog.length <= 32)
    for (const definition of browseCatalog) {
      await deleteSpellCatalogIndex(ctx, definition._id);
      await ctx.db.delete('catalogEntry', definition._id);
    }
  else
    await ctx.scheduler.runAfter(
      0,
      internal.characterSheetSpells.cleanupCatalog,
      { characterId },
    );
  await reconcileCompanionRelationships(ctx, characterId, operationId);
}
