import { ConvexError, v } from 'convex/values';
import { calculateMilitiaCharacterFacts } from './militiaCharacterFacts';
import { zodOutputToConvex } from 'convex-helpers/server/zod4';
import type { MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { militiaSetupSchema } from '../../src/lib/canonical-setup';
import {
  militiaSnapshotSchema,
  weeklySourceKey,
} from '../../src/lib/canonical-weekly-source';
import {
  mirrorRosterKinds,
  normalizeCharacterKind,
  type CharacterKind,
  type SubmittedKind,
} from '../../src/lib/character-kind';

export async function updateCanonicalCharacter(
  ctx: MutationCtx,
  characterId: Id<'character'>,
  preparedSheet?: Parameters<typeof calculateMilitiaCharacterFacts>[2],
) {
  const character = await ctx.db.get('character', characterId);
  if (!character) throw new ConvexError('Character not found');
  const campaignId = character.campaignId;
  if (!campaignId) return;
  const militia = await ctx.db
    .query('militia')
    .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
    .unique();
  if (!militia) return;
  const source = await ctx.db
    .query('canonicalMilitiaState')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militia._id))
    .unique();
  if (!source) return;
  const facts = await calculateMilitiaCharacterFacts(
    ctx,
    character,
    preparedSheet,
  );
  const characters = source.snapshot.characters.some(
    (c) => c.characterId === characterId,
  )
    ? source.snapshot.characters.map((c) =>
        c.characterId === characterId ? facts : c,
      )
    : [...source.snapshot.characters, facts];
  // The record owns the kind: its roster mirror follows in the same write.
  const kind = character.kind;
  const roster = {
    ...source.snapshot.roster,
    people: source.snapshot.roster.people.map((p) =>
      p.characterId === characterId ? { ...p, kind } : p,
    ),
  };
  if (
    weeklySourceKey(characters) ===
      weeklySourceKey(source.snapshot.characters) &&
    weeklySourceKey(roster) === weeklySourceKey(source.snapshot.roster)
  )
    return;
  await ctx.db.patch('canonicalMilitiaState', source._id, {
    revision: source.revision + 1,
    snapshot: {
      ...source.snapshot,
      characters,
      roster,
    },
  });
}

// A live source about to be written, with every roster kind resolved against
// the campaign's current records, so a stale or old-client payload can never
// restore an earlier kind. People without a record in this campaign keep their
// own kind; reference checks decide whether they may stay.
export async function withCurrentRecordKinds<
  Snapshot extends {
    roster: { people: { characterId: string; kind: CharacterKind }[] };
  },
>(
  ctx: MutationCtx,
  campaignId: Id<'campaign'>,
  snapshot: Snapshot,
): Promise<Snapshot> {
  const records = [];
  for (const { characterId } of snapshot.roster.people) {
    const id = ctx.db.normalizeId('character', characterId);
    const record = id && (await ctx.db.get('character', id));
    if (record?.campaignId === campaignId)
      records.push({ characterId, kind: record.kind });
  }
  return {
    ...snapshot,
    roster: mirrorRosterKinds(snapshot.roster, records),
  };
}

// B3: a browser still on a bundle from before #180 may submit the legacy
// roster labels officer_npc and other_npc with a Setup or Militia correction.
// Storage takes only PC or NPC, so these argument validators accept the old
// labels and `withSubmittedKindsNormalized` maps them before parsing. Remove
// them with B3 and use the stored validators directly.
const submittedKindValidator = v.union(
  v.literal('pc'),
  v.literal('officer_npc'),
  v.literal('other_npc'),
  v.literal('npc'),
);
const snapshotValidator = zodOutputToConvex(militiaSnapshotSchema);
const { roster } = snapshotValidator.fields;
export const submittedSnapshotValidator = v.object({
  ...snapshotValidator.fields,
  roster: v.object({
    ...roster.fields,
    people: v.array(
      v.object({
        ...roster.fields.people.element.fields,
        kind: submittedKindValidator,
      }),
    ),
  }),
});
const setupValidator = zodOutputToConvex(militiaSetupSchema);
export const submittedSetupValidator = v.object({
  ...setupValidator.fields,
  state: v.object({
    ...setupValidator.fields.state.fields,
    militiaSnapshot: submittedSnapshotValidator,
  }),
});

export function withSubmittedKindsNormalized<
  Snapshot extends {
    roster: { people: { characterId: string; kind: SubmittedKind }[] };
  },
>(snapshot: Snapshot) {
  return {
    ...snapshot,
    roster: {
      ...snapshot.roster,
      people: snapshot.roster.people.map((person) => ({
        ...person,
        kind: normalizeCharacterKind(person.kind),
      })),
    },
  };
}
