import { representativeCompanionRules } from '../../src/lib/catalog/representative-companion-rules';
import { ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import type { MutationCtx } from '../_generated/server';
import { requireCharacterAccess } from './characterAccess';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';
import {
  loadCharacterSheet,
  pruneWarningAcceptancesAndRecordChange,
} from './characterSheet';
import {
  getCompanionSupportingEntryKeys,
  isSupportingSourceAvailable,
  readCompanionGraph,
  listRelationshipLinkedInputs,
  resolveCuratedCompanionSources,
  findCuratedCompanionBinding,
} from './companionRelationships';
import {
  readCompanionLinkedInput,
  resolveCompanionLinkedInput,
  companionLinkedInputSchema,
  linkedInputKey,
  isLinkedInputInterpretationCandidate,
  type CompanionLinkedInput,
  type CompanionLinkedInputResolution,
  type CompanionLinkedInputValue,
  type LinkedInputProjection,
  type LinkedInputUnavailableReason,
} from '../../src/lib/character-sheet-linked-inputs';

type RelationshipScope = {
  characterId: Doc<'character'>['_id'];
  relationshipId: Doc<'companionRelationship'>['_id'];
};
type InputScope = RelationshipScope & { input: CompanionLinkedInput };
function requireValidLinkedInput(input: CompanionLinkedInput) {
  const parsed = companionLinkedInputSchema.safeParse(input);
  if (
    !parsed.success ||
    (input.kind === 'classLevels' &&
      input.classRuleIdentity !== input.classRuleIdentity.trim())
  )
    throw new ConvexError('Provide a valid named linked input');
}
export async function loadLinkedInputScope(
  ctx: ReadCtx,
  args: RelationshipScope,
  { isWritable = false }: { isWritable?: boolean } = {},
) {
  const sheet = await loadCharacterSheet(ctx, args, { isWritable });
  if (!sheet) throw new ConvexError('Character Sheet not found');
  const relationship = await ctx.db.get(
    'companionRelationship',
    args.relationshipId,
  );
  if (
    !relationship ||
    (relationship.associatedCharacterId !== args.characterId &&
      relationship.companionCharacterId !== args.characterId)
  )
    throw new ConvexError('Companion Relationship not found');
  const saved = await ctx.db
    .query('characterLinkedInput')
    .withIndex('by_characterId_and_relationshipId', (q) =>
      q
        .eq('characterId', args.characterId)
        .eq('relationshipId', args.relationshipId),
    )
    .take(129);
  if (saved.length > 128) throw new ConvexError('Too many named linked inputs');
  return { sheet, relationship, saved };
}
export type LinkedInputRead = CompanionLinkedInputResolution & {
  sources: { key: string; label: string }[];
  unavailableReason: LinkedInputUnavailableReason | null;
  revision: number;
  lastOperationId: string | null;
  updatedBy: string | null;
};
async function loadLinkedInputContext(
  ctx: ReadCtx,
  scope: Awaited<ReturnType<typeof loadLinkedInputScope>>,
  projection: LinkedInputProjection = 'current',
) {
  const { sheet, relationship } = scope;
  const endpointId =
    relationship.associatedCharacterId === sheet.character._id
      ? relationship.companionCharacterId
      : relationship.associatedCharacterId;
  const endpointAccess = await readEndpointAccess(ctx, endpointId);
  const endpoint = endpointAccess
    ? await loadCharacterSheet(ctx, { characterId: endpointId })
    : null;
  const graph = endpoint
    ? await readCompanionGraph(ctx, sheet.character._id, [sheet, endpoint])
    : null;
  const isActive = graph?.states.get(relationship._id)?.status === 'active';
  const associated =
    relationship.associatedCharacterId === sheet.character._id
      ? sheet
      : endpoint;
  const calculated = associated
    ? projection === 'permanent'
      ? calculateActiveCharacterSheet(
          {
            entries: associated.entries,
            catalogEntries: associated.catalogEntries,
            characterKind: associated.character.kind,
            sheetMode: associated.character.sheetMode,
          },
          await requireCompatibleActiveRelease(ctx),
        ).permanent
      : associated.calculated
    : null;
  const countingEntries = getCompanionSupportingEntryKeys(
    associated && calculated ? { ...associated, calculated } : null,
  );
  const sources = resolveCuratedCompanionSources({
    relationship,
    sheet: associated,
  });
  return {
    ...scope,
    associated,
    calculated,
    sources,
    countingEntries,
    isActive,
    endpointAccess,
    endpoint,
  };
}
async function readEndpointAccess(
  ctx: ReadCtx,
  characterId: Doc<'character'>['_id'],
) {
  try {
    await requireCharacterAccess(ctx, { characterId });
    return true;
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    return false;
  }
}
function requireCuratedLinkedInput(
  relationship: Pick<Doc<'companionRelationship'>, 'kind' | 'sources'>,
  input: CompanionLinkedInput,
) {
  requireValidLinkedInput(input);
  const inputKey = linkedInputKey(input);
  if (
    !listRelationshipLinkedInputs(relationship).some(
      (row) => linkedInputKey(row.input) === inputKey,
    )
  )
    throw new ConvexError(
      'Choose a named input supplied by this Companion Relationship',
    );
  return inputKey;
}
function readUnavailableReason(
  context: Awaited<ReturnType<typeof loadLinkedInputContext>>,
): LinkedInputUnavailableReason {
  if (!context.endpointAccess) return 'inaccessible';
  if (!context.endpoint) return 'missingInput';
  return context.isActive ? 'missingInput' : 'interrupted';
}
function resolveLinkedInput(
  context: Awaited<ReturnType<typeof loadLinkedInputContext>>,
  input: CompanionLinkedInput,
  values: Map<string, CompanionLinkedInputValue>,
): LinkedInputRead {
  const {
    sheet,
    relationship,
    saved,
    associated,
    calculated,
    sources,
    countingEntries,
    isActive,
    endpointAccess,
  } = context;
  const inputKey = requireCuratedLinkedInput(
    { ...relationship, sources },
    input,
  );
  const recorded = saved.find((row) => row.inputKey === inputKey);
  const declaredSources = sources.flatMap((source) => {
    const binding = findCuratedCompanionBinding(
      source,
      relationship.kind,
      input,
    );
    return binding ? [{ source, binding }] : [];
  });
  const availableSources = declaredSources.filter(
    ({ source }) =>
      source.enabled && isSupportingSourceAvailable(source, countingEntries),
  );
  const supportedFamilies = [
    ...new Set(
      sources
        .filter(
          (source) =>
            source.enabled &&
            isSupportingSourceAvailable(source, countingEntries),
        )
        .flatMap((source) => {
          const identity =
            representativeCompanionRules[source.ruleKind]
              .contributingClassRuleIdentity;
          return identity ? [identity] : [];
        }),
    ),
  ];
  const candidates =
    endpointAccess && isActive && associated && calculated
      ? availableSources.map(({ source, binding }) => {
          const valueKey = linkedInputKey(binding.sourceInput);
          const value =
            values.get(valueKey) ??
            readCompanionLinkedInput({
              input: binding.sourceInput,
              sheet: {
                entries: associated.entries,
                catalogEntries: associated.catalogEntries,
                characterKind: associated.character.kind,
                sheetMode: associated.character.sheetMode,
              },
              calculated,
              contributingClassRuleIdentities: supportedFamilies,
            });
          values.set(valueKey, value);
          return {
            sourceKey: source.key,
            ...(binding.role ? { role: binding.role } : {}),
            ...value,
          };
        })
      : [];
  const precedence = declaredSources
    .filter(({ binding }) => binding.precedence !== undefined)
    .sort((left, right) => left.binding.precedence! - right.binding.precedence!)
    .map(({ source }) => source.key);
  const resolution = resolveCompanionLinkedInput({
    input,
    candidates,
    fallback: recorded?.fallback,
    interpretation: recorded?.interpretation,
    ...(precedence.length ? { precedence } : {}),
  });
  return {
    ...resolution,
    sources:
      endpointAccess && isActive
        ? declaredSources.map(({ source }) => ({
            key: source.key,
            label: source.label,
          }))
        : [],
    unavailableReason:
      resolution.status === 'unavailable'
        ? readUnavailableReason(context)
        : null,
    interpretation: recorded?.interpretation
      ? endpointAccess
        ? recorded.interpretation
        : {
            sourceKey: `rule:${
              relationship.sources.find(
                (source) => source.key === recorded.interpretation?.sourceKey,
              )?.ruleKind ?? relationship.kind
            }`,
          }
      : null,
    revision: sheet.revision,
    lastOperationId: sheet.lastOperationId,
    updatedBy: sheet.updatedBy,
  };
}
export async function readLinkedInput(
  ctx: ReadCtx,
  args: InputScope & { projection?: LinkedInputProjection },
): Promise<LinkedInputRead> {
  const scope = await loadLinkedInputScope(ctx, args);
  const context = await loadLinkedInputContext(ctx, scope, args.projection);
  return resolveLinkedInput(context, args.input, new Map());
}
export async function listLinkedInputs(
  ctx: ReadCtx,
  args: RelationshipScope & { projection?: LinkedInputProjection },
): Promise<LinkedInputRead[]> {
  const scope = await loadLinkedInputScope(ctx, args);
  const context = await loadLinkedInputContext(ctx, scope, args.projection);
  const values = new Map<string, CompanionLinkedInputValue>();
  return listRelationshipLinkedInputs({
    ...scope.relationship,
    sources: context.sources,
  }).map(({ input }) => resolveLinkedInput(context, input, values));
}
export async function writeLinkedInput(
  ctx: MutationCtx,
  args: InputScope & { operationId: string },
  change:
    | { kind: 'saveFallback'; value: number }
    | { kind: 'clearFallback' }
    | { kind: 'saveInterpretation'; sourceKey: string }
    | { kind: 'clearInterpretation' },
) {
  const scope = await loadLinkedInputScope(ctx, args, {
    isWritable: true,
  });
  const context = await loadLinkedInputContext(ctx, scope);
  const { sheet, relationship, saved } = scope;
  const inputKey = requireCuratedLinkedInput(
    { ...relationship, sources: context.sources },
    args.input,
  );
  const recorded = saved.find((row) => row.inputKey === inputKey);
  if (!args.operationId.trim())
    throw new ConvexError('Provide an operation identifier');
  if (change.kind === 'saveFallback' && !Number.isSafeInteger(change.value))
    throw new ConvexError('Enter a finite whole fallback value');
  if (change.kind === 'saveInterpretation') {
    const current = resolveLinkedInput(context, args.input, new Map());
    if (
      !current.candidates.some(
        (candidate) =>
          candidate.sourceKey === change.sourceKey &&
          isLinkedInputInterpretationCandidate(candidate),
      )
    )
      throw new ConvexError(
        'Choose an available supporting source from this relationship',
      );
  }
  const fallback =
    change.kind === 'saveFallback'
      ? change.value
      : change.kind === 'clearFallback'
        ? undefined
        : recorded?.fallback;
  const interpretation =
    change.kind === 'saveInterpretation'
      ? { sourceKey: change.sourceKey }
      : change.kind === 'clearInterpretation'
        ? undefined
        : recorded?.interpretation;
  if (recorded) {
    if (fallback === undefined && interpretation === undefined)
      await ctx.db.delete('characterLinkedInput', recorded._id);
    else
      await ctx.db.patch('characterLinkedInput', recorded._id, {
        fallback,
        interpretation,
      });
  } else if (fallback !== undefined || interpretation !== undefined)
    await ctx.db.insert('characterLinkedInput', {
      characterId: args.characterId,
      relationshipId: args.relationshipId,
      inputKey,
      input: args.input,
      ...(fallback === undefined ? {} : { fallback }),
      ...(interpretation === undefined ? {} : { interpretation }),
    });
  await pruneWarningAcceptancesAndRecordChange(ctx, {
    sheet,
    operationId: args.operationId,
  });
  return null;
}
