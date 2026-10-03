import { ConvexError, v, type Infer } from 'convex/values';
import { query } from './_generated/server';
import {
  buildRecordedCatalogState,
  validatePersonalAdjustment,
  validateSheetEntryDetail,
  requireEntryChoice,
} from './characterSheet';
import {
  resolveCharacterSheetGrants,
  formatGrantKeyId,
} from '../src/lib/character-sheet-grants';
import { remapCatalogReferences } from '../src/lib/catalog-copy-references';
import {
  findPreferredCampaignCopy,
  preserveCuratedModifierFields,
  projectCampaignCopies,
  writeCatalogDefinition,
} from './lib/catalogCopies';
import { legacyCharacterMutation } from './lib/campaignRuntime';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { releaseFingerprint } from '../src/lib/catalog/release-schema';
import { hasAccessToOrg } from './user';
import { requireCompatibleActiveRelease } from './lib/catalogReleaseCompatibility';
import { requireCharacterAccess } from './lib/characterAccess';
import schema, {
  catalogEntryValidator,
  catalogModifierValidator,
  grantKeyValidator,
} from './schema';
import {
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
  type LoadedCharacterSheet,
} from './lib/characterSheet';
import {
  maxCharacterChildRows,
  maxPreparedCharacters,
  listCatalogDependencies,
} from './lib/preparedCharacterSheet';
import {
  createCatalogSheetEntryState,
  isSelectableCatalogSheetEntryKind,
} from '../src/lib/character-sheet-entries';

const scope = {
  organizationId: v.optional(v.string()),
  campaignId: v.optional(v.id('campaign')),
  characterId: v.id('character'),
};
const writeScope = { ...scope, operationId: v.string() };
const maxCatalogBrowserRows = 8192;
const definitionValidator = v.union(
  ...catalogEntryValidator.members.map((member) =>
    member
      .omit(
        'scope',
        'characterId',
        'campaignId',
        'copiedFrom',
        'copiedFromFingerprint',
        'campaignPreference',
        'ruleIdentity',
      )
      .extend({
        modifiers: v.array(catalogModifierValidator.omit('stacksWithinEntry')),
      }),
  ),
);

function requireFiniteDefinitionNumbers(value: unknown): void {
  if (typeof value === 'number' && !Number.isFinite(value))
    throw new ConvexError('Catalog definition numbers must be finite');
  if (Array.isArray(value)) {
    for (const child of value) requireFiniteDefinitionNumbers(child);
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value))
      requireFiniteDefinitionNumbers(child);
  }
}

function requireRacialModifierChoices(
  kind: string,
  modifiers: readonly Infer<typeof catalogModifierValidator>[],
) {
  if (
    kind !== 'racialTrait' &&
    modifiers.some((modifier) => modifier.target === 'ability.$choice')
  )
    throw new ConvexError('Ability score choices belong to Racial Traits');
}

export const createOneOff = legacyCharacterMutation({
  args: {
    ...writeScope,
    definition: definitionValidator,
    choice: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.id('characterSheetEntry'),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet is unavailable');
    requireFiniteDefinitionNumbers(args.definition);
    requireRacialModifierChoices(
      args.definition.detail.kind,
      args.definition.modifiers,
    );
    const name = args.definition.name.trim();
    if (!name) throw new ConvexError('Catalog Entry name cannot be empty');
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers: args.definition.modifiers,
    });
    requireEntryChoice(args.definition.detail.kind, args.choice);
    const detail = args.definition.detail;
    if (
      detail.kind === 'item' ||
      detail.kind === 'spell' ||
      detail.kind === 'spellEffect' ||
      detail.kind === 'condition'
    )
      validateSheetEntryDetail(detail);
    if (!isSelectableCatalogSheetEntryKind(args.definition.detail.kind))
      throw new ConvexError('This definition cannot be selected as a one-off');
    if (
      sheet.entries.length >= maxCharacterChildRows ||
      sheet.catalogEntries.filter(
        (row) =>
          row.scope === 'character' && row.characterId === args.characterId,
      ).length >= maxCharacterChildRows
    )
      throw new ConvexError('Character sheet is too large');
    const catalogEntryId = await writeCatalogDefinition(ctx, {
      ...args.definition,
      name,
      scope: 'character',
      characterId: args.characterId,
      ruleIdentity: `one-off:${args.characterId}`,
    });
    await ctx.db.patch('catalogEntry', catalogEntryId, {
      ruleIdentity: `one-off:${catalogEntryId}`,
    });
    const entryId = await ctx.db.insert('characterSheetEntry', {
      ...createCatalogSheetEntryState(
        args.definition.detail.kind,
        args.choice,
        args.definition.detail.kind === 'spellEffect'
          ? args.definition.detail.defaultCasterLevel
          : undefined,
      ),
      characterId: args.characterId,
      active: true,
      catalogEntryId,
    });
    const resultingSheet = await loadCharacterSheet(ctx, args, {
      isWritable: true,
    });
    if (!resultingSheet)
      throw new ConvexError('Character Sheet is unavailable');
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet: resultingSheet,
      operationId: args.operationId,
    });
    return entryId;
  },
});

export const list = query({
  args: scope,
  returns: v.array(schema.doc('catalogEntry')),
  async handler(ctx, args) {
    const { character } = await requireCharacterAccess(ctx, args);
    if (!character.sheetMode) return [];
    await requireCompatibleActiveRelease(ctx);
    const [globals, campaignDefinitions] = await Promise.all([
      ctx.db
        .query('catalogEntry')
        .withIndex('by_scope', (q) => q.eq('scope', 'global'))
        .take(maxCatalogBrowserRows / 2),
      character.campaignId
        ? ctx.db
            .query('catalogEntry')
            .withIndex('by_campaignId_and_scope', (q) =>
              q.eq('campaignId', character.campaignId).eq('scope', 'campaign'),
            )
            .take(maxCatalogBrowserRows / 2)
        : [],
    ]);
    const localDefinitions = await ctx.db
      .query('catalogEntry')
      .withIndex('by_characterId', (q) => q.eq('characterId', args.characterId))
      .take(maxCharacterChildRows);
    const definitions = [
      ...localDefinitions,
      ...campaignDefinitions,
      ...globals,
    ];
    const preferred = await Promise.all(
      globals.map((row) =>
        findPreferredCampaignCopy(ctx, {
          campaignId: character.campaignId,
          originalId: row._id,
          candidates: campaignDefinitions,
        }),
      ),
    );
    const replacedIds = new Set(
      preferred.flatMap((row) => (row?.copiedFrom ? [row.copiedFrom] : [])),
    );
    return definitions
      .filter(
        (row) =>
          row.detail.kind !== 'base' &&
          !(row.scope === 'global' && replacedIds.has(row._id)),
      )
      .slice(0, maxCatalogBrowserRows);
  },
});

export const saveToCatalog = legacyCharacterMutation({
  args: { ...writeScope, catalogEntryId: v.id('catalogEntry') },
  returns: v.id('catalogEntry'),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet is unavailable');
    if (!sheet.campaign)
      throw new ConvexError('Save to catalog requires a campaign');
    const definition = await ctx.db.get('catalogEntry', args.catalogEntryId);
    if (
      !sheet.catalogEntries.some((row) => row._id === args.catalogEntryId) ||
      definition?.scope !== 'character' ||
      definition.characterId !== args.characterId ||
      definition.detail.kind === 'base'
    )
      throw new ConvexError('Choose a Character-specific definition');
    for (const { id } of listCatalogDependencies(definition)) {
      const dependency = sheet.catalogEntries.find((row) => row._id === id);
      if (dependency?.scope === 'character')
        throw new ConvexError(
          'Save dependent Character-specific definitions to the campaign first',
        );
    }
    const { _id, _creationTime, ...body } = definition;
    await writeCatalogDefinition(
      ctx,
      {
        ...body,
        scope: 'campaign',
        campaignId: sheet.campaign.campaignId,
        characterId: undefined,
      },
      definition._id,
    );
    sheet.catalogEntries = sheet.catalogEntries.map((row) =>
      row._id === definition._id
        ? {
            ...row,
            scope: 'campaign',
            campaignId: sheet.campaign?.campaignId,
            characterId: undefined,
          }
        : row,
    );
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet,
      operationId: args.operationId,
    });
    return definition._id;
  },
});

async function calculateDefinitionFingerprint(definition: Doc<'catalogEntry'>) {
  const {
    _id,
    _creationTime,
    scope: _scope,
    characterId: _characterId,
    campaignId: _campaignId,
    copiedFrom: _copiedFrom,
    copiedFromFingerprint: _copiedFromFingerprint,
    campaignPreference: _campaignPreference,
    ...body
  } = definition;
  return releaseFingerprint(body);
}
async function copyDefinition(
  ctx: MutationCtx,
  definition: Doc<'catalogEntry'>,
  destination:
    | { scope: 'character'; characterId: Id<'character'> }
    | { scope: 'campaign'; campaignId: Id<'campaign'> },
) {
  const original = await ctx.db.get('catalogEntry', definition._id);
  if (!original) throw new ConvexError('Catalog Entry is unavailable');
  const {
    _id,
    _creationTime,
    scope: _scope,
    characterId: _characterId,
    campaignId: _campaignId,
    campaignPreference: _campaignPreference,
    ...body
  } = original;
  return writeCatalogDefinition(ctx, {
    ...body,
    ...destination,
    ...(destination.scope === 'campaign'
      ? { campaignPreference: true as const }
      : {}),
    copiedFrom: definition._id,
    copiedFromFingerprint: await calculateDefinitionFingerprint(original),
    ruleIdentity: definition.ruleIdentity,
    sourceKey: definition.sourceKey ?? definition.ruleIdentity,
  });
}
async function loadCampaignSheets(
  ctx: MutationCtx,
  initialSheet: LoadedCharacterSheet,
  additionalScope: Parameters<typeof loadCharacterSheet>[1],
) {
  const characters = await ctx.db
    .query('character')
    .withIndex('by_campaignId', (q) =>
      q.eq('campaignId', initialSheet.character.campaignId),
    )
    .take(maxPreparedCharacters + 1);
  if (characters.length > maxPreparedCharacters)
    throw new ConvexError('This campaign exceeds the prepared Character limit');
  const sheets: LoadedCharacterSheet[] = [];
  for (const character of characters) {
    if (!character.sheetMode) continue;
    const sheet =
      character._id === initialSheet.character._id
        ? initialSheet
        : await loadCharacterSheet(
            ctx,
            { ...additionalScope, characterId: character._id },
            { isWritable: true },
          );
    if (sheet) sheets.push(sheet);
  }
  return sheets;
}

async function repointSheetRows(
  ctx: MutationCtx,
  sheet: LoadedCharacterSheet,
  originalId: Id<'catalogEntry'>,
  copyId: Id<'catalogEntry'>,
) {
  sheet.entries = await Promise.all(
    sheet.entries.map(async (row) => {
      const mapped = remapCatalogReferences(row, originalId, copyId);
      if (JSON.stringify(mapped) !== JSON.stringify(row)) {
        const { _id, _creationTime, ...body } = mapped;
        await ctx.db.replace('characterSheetEntry', _id, body);
      }
      return mapped;
    }),
  );
}

function repointSheetDefinitions(
  sheet: LoadedCharacterSheet,
  copy: Doc<'catalogEntry'>,
) {
  // The persisted origin's rule facts do not change when a campaign chooses a copy.
  // Copied parents retain frozen references; uncopied parents use campaign choices.
  sheet.catalogEntries = projectCampaignCopies([...sheet.catalogEntries, copy]);
}

async function repinCampaignGrants(
  ctx: MutationCtx,
  previousSheet: LoadedCharacterSheet,
  resultingSheet: LoadedCharacterSheet,
  originalId: Id<'catalogEntry'>,
  copyId: Id<'catalogEntry'>,
) {
  const resolve = (sheet: LoadedCharacterSheet) =>
    resolveCharacterSheetGrants({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries,
      characterKind: sheet.character.kind,
    }).allEntries;
  const previousGrants = resolve(previousSheet);
  const resultingGrants = resolve(resultingSheet);
  for (const previous of previousGrants) {
    if (
      previous.origin !== 'grant' ||
      !('grantKey' in previous.entry) ||
      !previous.entry.grantKey ||
      !('catalogEntryId' in previous.entry)
    )
      continue;
    const previousCatalogId = previous.entry.catalogEntryId;
    const previousDefinition = previousSheet.catalogEntries.find(
      (row) => row._id === previousCatalogId,
    );
    const desiredId =
      previousDefinition?._id === originalId ? copyId : previousDefinition?._id;
    if (
      !desiredId ||
      (desiredId !== copyId && previousDefinition?.scope !== 'campaign')
    )
      continue;
    const resulting = resultingGrants.find(
      (row) => row.entry._id === previous.entry._id,
    );
    if (
      resulting &&
      'catalogEntryId' in resulting.entry &&
      resulting.entry.catalogEntryId === desiredId &&
      desiredId !== copyId
    )
      continue;
    const stored = resultingSheet.entries.find(
      (row) => row._id === previous.storedEntryId,
    );
    if (stored && 'catalogEntryId' in stored && stored.kind !== 'base') {
      await ctx.db.patch('characterSheetEntry', stored._id, {
        catalogEntryId: desiredId,
        catalogOverride: true,
      });
      resultingSheet.entries = resultingSheet.entries.map((row) =>
        row._id === stored._id
          ? { ...stored, catalogEntryId: desiredId, catalogOverride: true }
          : row,
      );
    } else {
      if (resultingSheet.entries.length >= maxCharacterChildRows)
        throw new ConvexError('Character sheet is too large');
      const id = await ctx.db.insert('characterSheetEntry', {
        ...buildRecordedCatalogState(ctx, previous.entry),
        characterId: previousSheet.character._id,
        catalogEntryId: desiredId,
        active: previous.entry.active,
        grantKey: previous.entry.grantKey,
        catalogOverride: true,
      });
      const row = await ctx.db.get('characterSheetEntry', id);
      if (row) resultingSheet.entries.push(row);
    }
  }
}

export const customizeForCampaign = legacyCharacterMutation({
  args: { ...writeScope, catalogEntryId: v.id('catalogEntry') },
  returns: v.id('catalogEntry'),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet is unavailable');
    if (!sheet.campaign)
      throw new ConvexError('Customize for campaign requires a campaign');
    const definition = sheet.catalogEntries.find(
      (row) => row._id === args.catalogEntryId,
    );
    if (definition?.scope !== 'global')
      throw new ConvexError('Choose a global definition to customize');
    const existing = await findPreferredCampaignCopy(ctx, {
      campaignId: sheet.character.campaignId,
      originalId: definition._id,
    });
    if (existing) return existing._id;
    const sheets = await loadCampaignSheets(ctx, sheet, args);
    const copyId = await copyDefinition(ctx, definition, {
      scope: 'campaign',
      campaignId: sheet.campaign.campaignId,
    });
    const copy = await ctx.db.get('catalogEntry', copyId);
    if (!copy) throw new ConvexError('Catalog Entry is unavailable');
    for (const previousSheet of sheets) {
      const resultingSheet = {
        ...previousSheet,
        entries: [...previousSheet.entries],
        catalogEntries: [...previousSheet.catalogEntries],
      };
      await repointSheetRows(ctx, resultingSheet, definition._id, copyId);
      repointSheetDefinitions(resultingSheet, copy);
      await repinCampaignGrants(
        ctx,
        previousSheet,
        resultingSheet,
        definition._id,
        copyId,
      );
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet: resultingSheet,
        operationId: args.operationId,
      });
    }
    return copyId;
  },
});

const detailValidator = v.union(
  ...catalogEntryValidator.members.map((member) => member.fields.detail),
);
export const editDefinition = legacyCharacterMutation({
  args: {
    ...writeScope,
    catalogEntryId: v.id('catalogEntry'),
    name: v.optional(v.string()),
    modifiers: v.optional(
      v.array(catalogModifierValidator.omit('stacksWithinEntry')),
    ),
    detail: v.optional(detailValidator),
  },
  returns: v.null(),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet is unavailable');
    const definition = await ctx.db.get('catalogEntry', args.catalogEntryId);
    if (
      !definition ||
      !sheet.catalogEntries.some((row) => row._id === definition._id)
    )
      throw new ConvexError('Catalog Entry is unavailable');
    if (definition.scope === 'global')
      throw new ConvexError('Global definitions are read-only');
    if (definition.detail.kind === 'base')
      throw new ConvexError('Use the base score editor');
    requireFiniteDefinitionNumbers(args);
    const name = args.name?.trim() ?? definition.name;
    if (!name) throw new ConvexError('Catalog Entry name cannot be empty');
    if (args.detail && args.detail.kind !== definition.detail.kind)
      throw new ConvexError('A Catalog Entry kind cannot be changed');
    requireRacialModifierChoices(
      definition.detail.kind,
      args.modifiers ?? definition.modifiers,
    );
    validatePersonalAdjustment({
      sheet,
      name,
      modifiers: args.modifiers ?? definition.modifiers,
      previousModifiers: definition.modifiers,
    });
    const detail = args.detail ?? definition.detail;
    if (
      detail.kind === 'item' ||
      detail.kind === 'spell' ||
      detail.kind === 'spellEffect' ||
      detail.kind === 'condition'
    )
      validateSheetEntryDetail(detail);
    const modifiers = args.modifiers
      ? preserveCuratedModifierFields(args.modifiers, definition.modifiers)
      : definition.modifiers;
    const sheets =
      definition.scope === 'campaign'
        ? await loadCampaignSheets(ctx, sheet, args)
        : [sheet];
    const { _id, _creationTime, ...body } = definition;
    await writeCatalogDefinition(
      ctx,
      { ...body, name, modifiers, detail },
      definition._id,
    );
    const updated = await ctx.db.get('catalogEntry', definition._id);
    if (!updated) throw new ConvexError('Catalog Entry is unavailable');
    if (updated.scope === 'campaign')
      for (const { id } of listCatalogDependencies(updated))
        if (
          sheet.catalogEntries.find((row) => row._id === id)?.scope ===
          'character'
        )
          throw new ConvexError(
            'Campaign definitions cannot depend on Character-specific definitions',
          );
    for (const affectedSheet of sheets) {
      affectedSheet.catalogEntries = projectCampaignCopies(
        affectedSheet.catalogEntries.map((row) =>
          row._id === updated._id ? updated : row,
        ),
      );
      await pruneWarningAcceptancesAndRecordChange(ctx, {
        sheet: affectedSheet,
        operationId: args.operationId,
      });
    }
    return null;
  },
});
export const advisories = query({
  args: scope,
  returns: v.array(
    v.object({
      catalogEntryId: v.id('catalogEntry'),
      originalId: v.id('catalogEntry'),
      originalName: v.string(),
    }),
  ),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args);
    if (!sheet) return [];
    const result = [];
    for (const copy of sheet.catalogEntries) {
      if (!copy.copiedFrom || !copy.copiedFromFingerprint) continue;
      const original = await ctx.db.get('catalogEntry', copy.copiedFrom);
      if (!original) continue;
      let accessible = original.scope === 'global';
      if (original.scope === 'campaign' && original.campaignId) {
        const campaign = await ctx.db.get('campaign', original.campaignId);
        accessible = Boolean(
          campaign && (await hasAccessToOrg(ctx, campaign.organizationId)),
        );
      } else if (original.scope === 'character' && original.characterId) {
        try {
          await requireCharacterAccess(ctx, {
            characterId: original.characterId,
          });
          accessible = true;
        } catch (error) {
          if (
            !(error instanceof ConvexError) ||
            error.data !== 'Character not found'
          )
            throw error;
          accessible = false;
        }
      }
      if (
        accessible &&
        (await calculateDefinitionFingerprint(original)) !==
          copy.copiedFromFingerprint
      )
        result.push({
          catalogEntryId: copy._id,
          originalId: original._id,
          originalName: original.name,
        });
    }
    return result;
  },
});

export const detach = legacyCharacterMutation({
  args: {
    ...writeScope,
    target: v.union(
      v.object({
        kind: v.literal('entry'),
        entryId: v.id('characterSheetEntry'),
      }),
      v.object({ kind: v.literal('grant'), grantKey: grantKeyValidator }),
    ),
  },
  returns: v.id('catalogEntry'),
  async handler(ctx, args) {
    const sheet = await loadCharacterSheet(ctx, args, { isWritable: true });
    if (!sheet) throw new ConvexError('Character Sheet is unavailable');
    const target = args.target;
    const stored =
      target.kind === 'entry'
        ? sheet.entries.find((row) => row._id === target.entryId)
        : sheet.entries.find(
            (row) =>
              'grantKey' in row &&
              row.grantKey &&
              formatGrantKeyId(row.grantKey) ===
                formatGrantKeyId(target.grantKey),
          );
    const grantKey =
      target.kind === 'grant'
        ? target.grantKey
        : stored && 'grantKey' in stored
          ? stored.grantKey
          : undefined;
    const grant = grantKey
      ? resolveCharacterSheetGrants({
          entries: sheet.entries,
          catalogEntries: sheet.catalogEntries,
          characterKind: sheet.character.kind,
        }).allEntries.find(
          (row) =>
            row.origin === 'grant' &&
            'grantKey' in row.entry &&
            row.entry.grantKey &&
            formatGrantKeyId(row.entry.grantKey) === formatGrantKeyId(grantKey),
        )
      : null;
    const catalogEntryId =
      grant && 'catalogEntryId' in grant.entry
        ? grant.entry.catalogEntryId
        : stored && 'catalogEntryId' in stored
          ? stored.catalogEntryId
          : stored?.kind === 'classLevel'
            ? stored.state.classEntryId
            : null;
    const definition = sheet.catalogEntries.find(
      (row) => row._id === catalogEntryId,
    );
    if (!definition || definition.detail.kind === 'base')
      throw new ConvexError('Catalog Entry does not belong to this Character');
    if (definition.scope === 'character')
      throw new ConvexError(
        'Character-specific definitions cannot be detached',
      );
    const copyId = await copyDefinition(ctx, definition, {
      scope: 'character',
      characterId: args.characterId,
    });
    if (stored?.kind === 'classLevel') {
      for (const row of sheet.entries) {
        const mapped = remapCatalogReferences(row, definition._id, copyId);
        const { _id, _creationTime, ...body } = mapped;
        if (JSON.stringify(mapped) !== JSON.stringify(row))
          await ctx.db.replace('characterSheetEntry', _id, body);
      }
    } else if (stored && 'catalogEntryId' in stored) {
      await ctx.db.patch('characterSheetEntry', stored._id, {
        catalogEntryId: copyId,
        ...('grantKey' in stored && stored.grantKey
          ? { catalogOverride: true as const }
          : {}),
      });
    } else if (grant && 'grantKey' in grant.entry && grant.entry.grantKey) {
      if (sheet.entries.length >= maxCharacterChildRows)
        throw new ConvexError('Character sheet is too large');
      await ctx.db.insert('characterSheetEntry', {
        ...buildRecordedCatalogState(ctx, grant.entry),
        characterId: args.characterId,
        catalogEntryId: copyId,
        active: grant.entry.active,
        grantKey: grant.entry.grantKey,
        catalogOverride: true,
        ...('notes' in grant.entry && grant.entry.notes !== undefined
          ? { notes: grant.entry.notes }
          : {}),
      });
    } else
      throw new ConvexError(
        'Character Sheet Entry does not belong to this Character',
      );
    const resultingSheet = await loadCharacterSheet(ctx, args, {
      isWritable: true,
    });
    if (!resultingSheet)
      throw new ConvexError('Character Sheet is unavailable');
    await pruneWarningAcceptancesAndRecordChange(ctx, {
      sheet: resultingSheet,
      operationId: args.operationId,
    });
    return copyId;
  },
});
