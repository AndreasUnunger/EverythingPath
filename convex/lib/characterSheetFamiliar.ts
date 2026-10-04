import { ConvexError } from 'convex/values';
import {
  calculateActiveCharacterSheet,
  requireCompatibleActiveRelease,
} from './catalogReleaseCompatibility';
import type { Doc, Id } from '../_generated/dataModel';
import type { ReadCtx } from '../types';
import { requireCharacterAccess } from './characterAccess';
import {
  listLinkedInputsForSheet,
  type LinkedEndpointReader,
} from './characterSheetLinkedInputReader';
import { readCharacterSheetData } from './characterSheetData';
import { readCompanionGraph } from './companionRelationshipGraph';

type Sheet = Awaited<ReturnType<typeof readCharacterSheetData>>;

// Raw sheet loading remains independent of relationship projection so graph
// eligibility can inspect recorded sources without recursively calculating them.
export async function applyFamiliarToSheet<T extends Sheet>(
  ctx: ReadCtx,
  sheet: T,
  {
    trustedLinkedInputs = false,
    recalculate = false,
    calculationIdentity,
    readSheet = (character) => readCharacterSheetData(ctx, character),
    readBudget,
  }: {
    trustedLinkedInputs?: boolean;
    recalculate?: boolean;
    calculationIdentity?: string;
    readSheet?: (character: Doc<'character'>) => Promise<Sheet>;
    readBudget?: {
      accountRead(value: unknown): void;
      accountReference(id: string): void;
    };
  } = {},
): Promise<T & { familiarRelationshipId: Id<'companionRelationship'> | null }> {
  const identity =
    calculationIdentity ?? (await requireCompatibleActiveRelease(ctx));
  const memo = new Map<Id<'character'>, Sheet>();
  const rawSheets = new Map<Id<'character'>, Sheet>([
    [sheet.character._id, sheet],
  ]);
  async function readRawSheet(character: Doc<'character'>) {
    const cached = rawSheets.get(character._id);
    if (cached) return cached;
    const loaded = await readSheet(character);
    rawSheets.set(character._id, loaded);
    return loaded;
  }
  const visiting = new Set<Id<'character'>>();
  const readEndpoint: LinkedEndpointReader = async (characterId) => {
    let character: Doc<'character'> | null;
    if (trustedLinkedInputs)
      character = await ctx.db.get('character', characterId);
    else {
      try {
        character = (await requireCharacterAccess(ctx, { characterId }))
          .character;
      } catch (error) {
        if (!(error instanceof ConvexError)) throw error;
        return { accessible: false, sheet: null };
      }
    }
    readBudget?.accountRead(character);
    readBudget?.accountReference(characterId);
    if (!character?.sheetMode) return { accessible: true, sheet: null };
    if (visiting.has(characterId)) return { accessible: true, sheet: null };
    const cached = memo.get(characterId);
    return {
      accessible: true,
      sheet: cached ?? (await calculate(await readRawSheet(character))),
    };
  };
  async function calculate<U extends Sheet>(
    baseline: U,
  ): Promise<
    U & { familiarRelationshipId: Id<'companionRelationship'> | null }
  > {
    const characterId = baseline.character._id;
    if (visiting.size >= 1024)
      throw new ConvexError('Too many connected Companions');
    visiting.add(characterId);
    const graph = await readCompanionGraph(ctx, characterId, [baseline], {
      readSheet: readRawSheet,
      readBudget,
    });
    const active = graph.active.get(characterId);
    const retained = [...graph.relationships.values()]
      .filter(
        (row) =>
          row.companionCharacterId === characterId && row.kind === 'familiar',
      )
      .sort(
        (a, b) =>
          Number(b.status === 'active') - Number(a.status === 'active') ||
          b.activatedAt - a.activatedAt ||
          b._creationTime - a._creationTime ||
          b._id.localeCompare(a._id),
      )[0];
    let relationship: Doc<'companionRelationship'> | undefined = retained;
    if (active) relationship = active.kind === 'familiar' ? active : undefined;
    if (!relationship) {
      visiting.delete(characterId);
      const projections = recalculate
        ? calculateActiveCharacterSheet(
            {
              entries: baseline.entries,
              catalogEntries: baseline.catalogEntries,
              characterKind: baseline.character.kind,
              sheetMode: baseline.character.sheetMode,
              familiarBaseCreatureKey:
                baseline.character.familiarBaseCreatureKey,
            },
            identity,
          )
        : null;
      const result = {
        ...baseline,
        ...(projections
          ? {
              calculated: projections.current,
              permanentCalculated: projections.permanent,
              permanentResolvedEntries: projections.permanent.resolvedEntries,
            }
          : {}),
        familiarRelationshipId: null,
      };
      memo.set(characterId, result);
      return result;
    }
    // Sequential projections share the completed endpoint memo and cannot
    // mistake concurrent traversal of one master for a graph cycle.
    const currentInputs = await listLinkedInputsForSheet(ctx, {
      sheet: baseline,
      relationship,
      projection: 'current',
      readEndpoint,
      graph,
      readBudget,
    });
    const permanentInputs = await listLinkedInputsForSheet(ctx, {
      sheet: baseline,
      relationship,
      projection: 'permanent',
      readEndpoint,
      graph,
      readBudget,
    });
    const familiar = {
      baseCreatureKey: baseline.character.familiarBaseCreatureKey,
    };
    const { current: calculated, permanent } = calculateActiveCharacterSheet(
      {
        entries: baseline.entries,
        catalogEntries: baseline.catalogEntries,
        characterKind: baseline.character.kind,
        sheetMode: baseline.character.sheetMode,
        familiarBaseCreatureKey: baseline.character.familiarBaseCreatureKey,
      },
      identity,
      {
        projectionInputs: {
          current: { familiar: { ...familiar, linkedInputs: currentInputs } },
          permanent: {
            familiar: { ...familiar, linkedInputs: permanentInputs },
          },
        },
      },
    );
    const { resolvedEntries: _resolvedEntries, ...permanentCalculated } =
      permanent;
    const result = {
      ...baseline,
      calculated,
      permanentCalculated,
      permanentResolvedEntries: permanent.resolvedEntries,
      familiarRelationshipId: relationship._id,
    };
    visiting.delete(characterId);
    memo.set(characterId, result);
    return result;
  }
  return await calculate(sheet);
}
