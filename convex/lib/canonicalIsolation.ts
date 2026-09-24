import type { QueryCtx, MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { ConvexError } from 'convex/values';
import { readCutover } from './campaignRuntime';
import {
  deploymentFixtureSchema,
  guardFixtureScope,
} from '../../e2e/fixtures/catalog';
// Live access is enabled only by the verified cutover. Membership and document
// scope remain independently enforced by each canonical endpoint.
export async function requireIsolated(
  ctx: QueryCtx | MutationCtx,
  campaignId: Id<'campaign'>,
) {
  if ((await readCutover(ctx))?.status === 'canonical') return;
  const campaign = await ctx.db.get('campaign', campaignId);
  const fixture = campaign?.e2eFixture;
  try {
    const config = deploymentFixtureSchema.parse(
      JSON.parse(process.env.E2E_FIXTURE_CONFIG ?? 'null'),
    );
    if (fixture?.caseKey !== 'canonicalPersistence')
      throw new Error('Unavailable');
    const token = config.workers.find(
      (worker) => worker.key === fixture.workerKey,
    )?.cases.canonicalPersistence;
    if (!token) throw new Error('Unavailable');
    guardFixtureScope(process.env, {
      ...fixture,
      caseKey: 'canonicalPersistence',
      token,
    });
  } catch {
    throw new ConvexError('Canonical editing is not enabled for this campaign');
  }
}
