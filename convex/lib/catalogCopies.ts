import { releaseFingerprint } from '../../src/lib/catalog/release-schema';
import { validate } from 'convex-helpers/validators';
import {
  catalogEntryValidator,
  type catalogModifierValidator,
} from '../schema';
import type { MutationCtx } from '../_generated/server';
import { ConvexError, compareValues, type Infer } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import {
  listCatalogReferences,
  type CatalogReference,
  remapCatalogReferences,
} from '../../src/lib/catalog-copy-references';

export async function findPreferredCampaignCopy(
  ctx: ReadCtx,
  {
    campaignId,
    originalId,
    candidates,
  }: {
    campaignId?: Id<'campaign'>;
    originalId: Id<'catalogEntry'>;
    candidates?: readonly Doc<'catalogEntry'>[];
  },
) {
  if (!campaignId) return null;
  if (candidates)
    return (
      candidates.find(
        (row) =>
          row.scope === 'campaign' &&
          row.campaignId === campaignId &&
          row.campaignPreference &&
          row.copiedFrom === originalId,
      ) ?? null
    );
  const copies = await ctx.db
    .query('catalogEntry')
    .withIndex(
      'by_campaignId_and_scope_and_copiedFrom_and_campaignPreference',
      (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('scope', 'campaign')
          .eq('copiedFrom', originalId)
          .eq('campaignPreference', true),
    )
    .unique();
  return copies;
}

export function requireCatalogDefinitionScope(
  definition: Pick<Doc<'catalogEntry'>, 'scope' | 'characterId' | 'campaignId'>,
) {
  if (
    (definition.scope === 'global' &&
      (definition.characterId || definition.campaignId)) ||
    (definition.scope === 'character' &&
      (!definition.characterId || definition.campaignId)) ||
    (definition.scope === 'campaign' &&
      (!definition.campaignId || definition.characterId))
  )
    throw new ConvexError('Catalog Entry scope is invalid');
}

export function requireEditableCharacterDefinition(
  definition: Doc<'catalogEntry'>,
  characterId: Id<'character'>,
  changesDefinition: boolean,
) {
  if (
    changesDefinition &&
    (definition.scope !== 'character' || definition.characterId !== characterId)
  )
    throw new ConvexError(
      'Shared definitions are read-only here; customize or detach the definition to edit it',
    );
}

export function projectCampaignCopies(
  definitions: readonly Doc<'catalogEntry'>[],
) {
  const copies = definitions.filter(
    (row) =>
      row.scope === 'campaign' && row.campaignPreference && row.copiedFrom,
  );
  return definitions.map((definition) => {
    if (definition.copiedFrom) return definition;
    const references = new Set(
      listCatalogReferences(definition).map(({ id }) => id),
    );
    let projected = definition;
    for (const copy of copies)
      if (copy.copiedFrom && references.has(copy.copiedFrom))
        projected = remapCatalogReferences(
          projected,
          copy.copiedFrom,
          copy._id,
        );
    return projected;
  });
}

export type CatalogLoadReference = CatalogReference & {
  refusalMessage?: string;
};

/** Load the authorized dependency graph, never unrelated shared catalog rows. */
export async function readReferencedCatalogDefinitions(
  ctx: ReadCtx,
  character: Doc<'character'>,
  initialDefinitions: readonly Doc<'catalogEntry'>[],
  references: CatalogLoadReference[],
  readBudget?: {
    accountRead(value: unknown): void;
    accountReference(id: string): void;
  },
) {
  const definitions = new Map<string, Doc<'catalogEntry'>>();
  const visited = new Set<string>();
  const pending: CatalogLoadReference[] = [...references];
  const refusalMessages = new Map(
    references.flatMap((reference) =>
      reference.refusalMessage
        ? [[reference.id, reference.refusalMessage] as const]
        : [],
    ),
  );
  function refuseReference(reference: CatalogLoadReference): never {
    throw new ConvexError(
      refusalMessages.get(reference.id) ??
        (reference.kind === 'class'
          ? 'Class counterpart does not belong to this Character'
          : 'Catalog dependency does not belong to this Character'),
    );
  }
  const seed = new Map(initialDefinitions.map((row) => [row._id, row]));
  pending.push(
    ...initialDefinitions.map((row) => ({
      id: row._id,
      kind: 'definition' as const,
    })),
  );
  while (pending.length) {
    const reference = pending.pop()!;
    if (visited.has(reference.id)) {
      if (reference.kind === 'definition' && !definitions.has(reference.id))
        refuseReference(reference);
      continue;
    }
    visited.add(reference.id);
    if (visited.size > 8192)
      throw new ConvexError('Character has too many catalog dependencies');
    const id = ctx.db.normalizeId('catalogEntry', reference.id);
    if (!id) refuseReference(reference);
    let definition = seed.get(id);
    if (!definition) {
      readBudget?.accountReference(id);
      const stored = await ctx.db.get('catalogEntry', id);
      readBudget?.accountRead(stored);
      definition = stored ?? undefined;
    }
    if (!definition) {
      if (reference.kind === 'definition') refuseReference(reference);
      continue;
    }
    if (
      definition.scope !== 'global' &&
      !(
        definition.scope === 'campaign' &&
        definition.campaignId === character.campaignId
      ) &&
      !(
        definition.scope === 'character' &&
        definition.characterId === character._id
      )
    )
      refuseReference(reference);
    definitions.set(id, definition);
    pending.push(...listCatalogReferences(definition));
    if (definition.scope === 'global') {
      const preferred = await findPreferredCampaignCopy(ctx, {
        campaignId: character.campaignId,
        originalId: id,
      });
      readBudget?.accountRead(preferred);
      if (preferred) {
        if (!seed.has(preferred._id))
          readBudget?.accountReference(preferred._id);
        seed.set(preferred._id, preferred);
        pending.push({ id: preferred._id, kind: 'definition' });
      }
    }
  }
  return projectCampaignCopies([...definitions.values()]);
}

/** Validate every new/rescoped definition before its atomic insert or patch. */
export async function writeCatalogDefinition(
  ctx: MutationCtx,
  definition: unknown,
  id?: Id<'catalogEntry'>,
) {
  if (!validate(catalogEntryValidator, definition, { db: ctx.db }))
    throw new ConvexError('Catalog definition is invalid');
  requireCatalogDefinitionScope(definition);
  if (id) {
    await ctx.db.patch('catalogEntry', id, definition);
    return id;
  }
  return ctx.db.insert('catalogEntry', definition);
}

export async function calculateDefinitionFingerprint(
  definition: Doc<'catalogEntry'>,
) {
  const {
    _id,
    _creationTime,
    scope: _scope,
    characterId: _characterId,
    campaignId: _campaignId,
    copiedFrom: _copiedFrom,
    copiedFromFingerprint: _copiedFromFingerprint,
    campaignPreference: _campaignPreference,
    racialStatisticsCopy: _racialStatisticsCopy,
    ...body
  } = definition;
  return releaseFingerprint(body);
}
export async function copyCatalogDefinition(
  ctx: MutationCtx,
  definition: Doc<'catalogEntry'>,
  destination:
    | { scope: 'character'; characterId: Id<'character'> }
    | { scope: 'campaign'; campaignId: Id<'campaign'> },
  changes: Partial<
    Pick<Doc<'catalogEntry'>, 'detail' | 'racialStatisticsCopy'>
  > = {},
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
    racialStatisticsCopy: _racialStatisticsCopy,
    ...body
  } = original;
  return writeCatalogDefinition(ctx, {
    ...body,
    ...destination,
    ...changes,
    ...(destination.scope === 'campaign'
      ? { campaignPreference: true as const }
      : {}),
    copiedFrom: definition._id,
    copiedFromFingerprint: await calculateDefinitionFingerprint(original),
    ruleIdentity: definition.ruleIdentity,
    sourceKey: definition.sourceKey ?? definition.ruleIdentity,
  });
}

type CatalogModifier = Infer<typeof catalogModifierValidator>;

export function preserveCuratedModifierFields<
  Modifier extends Omit<CatalogModifier, 'stacksWithinEntry'>,
>(
  modifiers: Modifier[],
  previous: CatalogModifier[],
): (Modifier & Pick<CatalogModifier, 'stacksWithinEntry'>)[] {
  const remaining = [...previous];
  const editableFields = ({
    stacksWithinEntry: _exception,
    ...editable
  }: CatalogModifier) => editable;
  const modifierIdentity = ({ value: _value, ...identity }: CatalogModifier) =>
    identity;
  // Reserve unchanged facts before pairing numeric edits, so a reorder cannot
  // move a curated exception onto a different bonus with the same identity.
  const matches = modifiers.map((modifier) => {
    const index = remaining.findIndex(
      (row) => compareValues(editableFields(row), modifier) === 0,
    );
    return index < 0 ? undefined : remaining.splice(index, 1)[0];
  });
  return modifiers.map((modifier, position) => {
    let matching = matches[position];
    if (!matching) {
      const index = remaining.findIndex(
        (row) =>
          compareValues(
            modifierIdentity(editableFields(row)),
            modifierIdentity(modifier),
          ) === 0,
      );
      matching = index < 0 ? undefined : remaining.splice(index, 1)[0];
    }
    return matching?.stacksWithinEntry
      ? { ...modifier, stacksWithinEntry: true as const }
      : modifier;
  });
}
