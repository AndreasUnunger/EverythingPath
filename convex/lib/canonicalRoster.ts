import { z } from 'zod';
import { ConvexError } from 'convex/values';
import {
  canonicalRosterSchema,
  rosterWarnings,
  type CanonicalRoster,
} from '../../src/lib/canonical-roster';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { requireScope } from './canonicalDraftStorage';
import { type scopeSchema } from './canonicalStorageValidators';
import { getMaxTeamsForRank } from '../weekBoardRules';

type Scope = z.infer<typeof scopeSchema>;
type ReadCtx = QueryCtx | MutationCtx;

async function findRoster(ctx: ReadCtx, militiaId: Scope['militiaId']) {
  return ctx.db
    .query('canonicalRoster')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', militiaId))
    .unique();
}

async function rosterContext(
  ctx: ReadCtx,
  scope: Scope,
  roster: CanonicalRoster,
) {
  const characters = [];
  for (const person of roster.people) {
    const characterId = ctx.db.normalizeId('character', person.characterId);
    const character =
      characterId && (await ctx.db.get('character', characterId));
    if (character?.campaignId !== scope.campaignId)
      throw new ConvexError('Character must belong to this campaign');
    characters.push({
      characterId: character._id,
      name: character.name,
      charisma: character.charisma,
      isActive: character.isActive !== false,
    });
  }
  const militia = await ctx.db.get('militia', scope.militiaId);
  if (!militia) throw new ConvexError('Militia not found');
  const maxTeams = getMaxTeamsForRank(militia.rank);
  return {
    characters,
    maxTeams,
    warnings: rosterWarnings(roster, characters, maxTeams),
  };
}

// Unregistered preparation seam: no route or live caller before paused cutover.
export async function readRoster(ctx: ReadCtx, input: Scope) {
  const scope = await requireScope(ctx, input);
  const row = await findRoster(ctx, scope.militiaId);
  if (!row) return null;
  if (row.campaignId !== scope.campaignId)
    throw new ConvexError('Invalid roster campaign');
  const roster = canonicalRosterSchema.parse(row.roster);
  return {
    roster,
    revision: row.revision,
    ...(await rosterContext(ctx, scope, roster)),
  };
}

export async function saveRoster(
  ctx: MutationCtx,
  input: Scope & { expectedRevision: number | null; roster: CanonicalRoster },
) {
  const scope = await requireScope(ctx, input);
  const roster = canonicalRosterSchema.parse(input.roster);
  const expected = z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .parse(input.expectedRevision);
  const current = await findRoster(ctx, scope.militiaId);
  if (current && current.campaignId !== scope.campaignId)
    throw new ConvexError('Invalid roster campaign');
  if ((current?.revision ?? null) !== expected)
    throw new ConvexError(
      'Roster changed. Review the latest roster before saving.',
    );
  const campaignContext = await ctx.db
    .query('canonicalCampaignContext')
    .withIndex('by_militiaId', (q) => q.eq('militiaId', scope.militiaId))
    .unique();
  if (campaignContext) {
    if (campaignContext.campaignId !== scope.campaignId)
      throw new ConvexError('Invalid context campaign');
    const teams = new Set(roster.teams.map((team) => team.teamId));
    const referenced = [
      ...campaignContext.context.events.flatMap((event) =>
        (event.targets ?? []).flatMap((target) =>
          target.kind === 'team' ? [target.teamId] : [],
        ),
      ),
      ...campaignContext.context.queuedEffects.flatMap((effect) =>
        effect.effect.kind === 'team_unavailable' ? [effect.effect.teamId] : [],
      ),
    ];
    if (referenced.some((teamId) => !teams.has(teamId)))
      throw new ConvexError(
        'A removed team is still referenced by campaign events or queued effects. Update those facts first.',
      );
  }
  const context = await rosterContext(ctx, scope, roster);
  const revision = (current?.revision ?? -1) + 1;
  if (current)
    await ctx.db.patch('canonicalRoster', current._id, { roster, revision });
  else await ctx.db.insert('canonicalRoster', { ...scope, roster, revision });
  return { roster, revision, ...context };
}
