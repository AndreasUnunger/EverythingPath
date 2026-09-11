// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import {
  openDraft,
  readOpenDraft,
  appendResolutionRecord,
  readEffectiveRecord,
} from './lib/canonicalDraftStorage';
import {
  projectWeeklyDraft,
  resolveReviewedWeeklyDraft,
  prepareCanonicalResolutionRecord,
} from '../src/lib/canonical-weekly-resolution';
import { persistentEventFixture } from '../tests/rules/persistent-event-fixture';
const modules = import.meta.glob('./**/*.ts');

test('[rules.P78.projection-parity] browser and persisted Convex source yield the same complete preview and immutable source/outcome', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/canonical-weekly-resolution.ts'),
        name: 'WeeklyRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output)) throw Error('Expected bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw Error('Expected JavaScript');
  for (const kind of ['low_morale', 'theft', 'rivalry'] as const) {
    const { draft, snapshot } = persistentEventFixture(kind);
    snapshot.training = 15;
    draft.persistent.decisions = [{ kind: 'buyoff', eventId: 'carried' }];
    draft.tableAdjustments = [
      {
        kind: 'militia_value',
        adjustmentId: 'copper',
        field: 'treasuryCopper',
        operation: 'add',
        value: 3,
        reason: 'Three copper found at the table',
      },
    ];
    const t = convexTest(schema, modules);
    const scope = await t.run(async (ctx) => {
      await ctx.db.insert('user', {
        tokenIdentifier: 'test|player',
        name: 'Player',
        image: '',
        orgIds: [{ orgId: 'test', role: 'member' }],
      });
      const campaignId = await ctx.db.insert('campaign', {
        name: 'Preview',
        ownerId: 'gm',
        organizationId: 'test',
        description: '',
      });
      const militiaId = await ctx.db.insert('militia', {
        campaignId,
        name: 'Militia',
        HQLocation: 'HQ',
        highestBoonReached: 3,
        rank: 3,
        training: 15,
        treasury: 300,
        focus: 'Loyalty',
      });
      return { campaignId, militiaId };
    });
    const player = t.withIdentity({ tokenIdentifier: 'test|player' });
    await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
    const server = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      return projectWeeklyDraft({ revision, militiaSnapshot: snapshot });
    });
    const browser: unknown = runInNewContext(
      `${script.code}; WeeklyRules.projectWeeklyDraft(input)`,
      {
        structuredClone,
        input: JSON.parse(
          JSON.stringify({ revision: draft, militiaSnapshot: snapshot }),
        ) as unknown,
      },
    );
    expect(browser, kind).toEqual(server);
    expect(server.status, kind).toBe('ready');
    expect(server.outcome?.militiaSnapshot.treasuryCopper).toBe(24003);
    expect(server.outcome?.context.carriedEvents).toEqual([]);
    const record = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      const result = resolveReviewedWeeklyDraft(
        { revision, militiaSnapshot: snapshot },
        server.sourceKey,
      );
      const record = prepareCanonicalResolutionRecord(result, `record-${kind}`);
      await appendResolutionRecord(ctx, { ...scope, record });
      return record;
    });
    expect(
      await player.run((ctx) =>
        readEffectiveRecord(ctx, { ...scope, week: draft.week }),
      ),
    ).toEqual(record);
    expect(record.finalOutcome.data).toEqual(
      JSON.parse(JSON.stringify(server.outcome)),
    );
    expect(record.sourceMilitiaSnapshot).toEqual(snapshot);
    expect(record.adjudication.tableAdjustments[0]?.reason).toBe(
      'Three copper found at the table',
    );
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  }
});
