import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { readCharacterSheetData } from './characterSheetData';
import { updateCanonicalCharacter } from './canonicalCharacters';
import {
  readCompanionGraph,
  isSupportingSourceAvailable,
} from './companionRelationshipGraph';
type CompanionSheet = Awaited<ReturnType<typeof readCharacterSheetData>>;

// Sheet edits publish support loss/restoration together with their existing state.
// Reads also derive eligibility, covering ownership/campaign changes and deletion.
export async function reconcileCompanionRelationships(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  operationId?: string,
  loadedSheets: CompanionSheet[] = [],
  previousCountingEntries?: Set<string>,
) {
  const graph = await readCompanionGraph(ctx, characterId, loadedSheets);
  for (const row of graph.relationships.values()) {
    const state = graph.states.get(row._id);
    const hasChangedAvailability =
      previousCountingEntries &&
      row.associatedCharacterId === characterId &&
      row.sources.some(
        (source) =>
          isSupportingSourceAvailable(source, previousCountingEntries) !==
          isSupportingSourceAvailable(
            source,
            graph.countingEntries.get(characterId),
          ),
      );
    if (
      state &&
      (state.status !== row.status || (operationId && hasChangedAvailability))
    )
      await ctx.db.patch('companionRelationship', row._id, {
        status: state.status,
        ...(operationId ? { lastOperationId: operationId } : {}),
      });
  }
  const pending = [characterId];
  const visited = new Set<Id<'character'>>();
  const familiars = new Set<Id<'character'>>();
  for (const id of pending) {
    if (visited.has(id)) continue;
    visited.add(id);
    for (const row of graph.relationships.values()) {
      if (row.associatedCharacterId !== id) continue;
      pending.push(row.companionCharacterId);
      if (row.kind === 'familiar') familiars.add(row.companionCharacterId);
    }
  }
  // Master and support edits publish downstream permanent facts together.
  // The canonical writer increments revisions only when those facts change.
  for (const familiarId of familiars)
    if (graph.characters.get(familiarId))
      await updateCanonicalCharacter(ctx, familiarId);
}
