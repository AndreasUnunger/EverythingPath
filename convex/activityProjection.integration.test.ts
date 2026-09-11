// @vitest-environment edge-runtime
import { expect, test } from 'vitest';
import { convexTest } from 'convex-test';
import { build } from 'vite';
import { runInNewContext } from 'node:vm';
import { resolve } from 'node:path';
import schema from './schema';
import { openDraft, readOpenDraft } from './lib/canonicalDraftStorage';
import { projectActivity } from '../src/lib/rules-activity';
import { roll } from '../tests/rules/upkeep-fixture';
import { activityFixture } from '../tests/rules/activity-fixture';

const modules = import.meta.glob('./**/*.ts');

test('[rules.A06.projection-parity] the browser build and persisted Convex source produce identical Activity plans', async () => {
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve('src/lib/rules-activity.ts'),
        name: 'ActivityRules',
        formats: ['iife'],
      },
    },
  });
  const output = Array.isArray(bundle) ? bundle[0] : bundle;
  if (!output || !('output' in output))
    throw new Error('Expected browser bundle');
  const script = output.output.find((entry) => entry.type === 'chunk');
  if (script?.type !== 'chunk') throw new Error('Expected browser JavaScript');
  for (const scenario of [
    'change_officer_role',
    'dismiss_team',
    'drill_militia',
    'recruit_team',
    'upgrade_team',
    'lie_low',
    'exceptional-recruitment',
  ] as const) {
    const t = convexTest(schema, modules);
    const { draft, snapshot } = activityFixture(
      scenario === 'exceptional-recruitment' ? 'recruit_team' : scenario,
    );
    if (scenario === 'exceptional-recruitment') {
      const slot = draft.activity.slots[0];
      if (!slot) throw new Error('Missing fixture slot');
      slot.choice = {
        choiceId: 'veterans',
        actionId: 'recruit_team',
        teamType: 'merchants',
        recruitmentCheck: { check: 'loyalty', dc: 10 },
        rolls: { check: roll(20, 10) },
      };
      draft.rulesExceptions = [
        {
          exceptionId: 'tier',
          subjectId: 'veterans',
          ruleId: 'recruit-tier',
          reason: 'Veterans join',
        },
      ];
    }
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
        training: 45,
        treasury: 30,
        focus: 'Loyalty',
      });
      return { campaignId, militiaId };
    });
    const player = t.withIdentity({ tokenIdentifier: 'test|player' });
    await player.run((ctx) => openDraft(ctx, { ...scope, draft }));
    const server = await player.run(async (ctx) => {
      const stored = await readOpenDraft(ctx, scope);
      if (!stored) throw new Error('Missing draft');
      return projectActivity(stored, snapshot);
    });
    const browser: unknown = runInNewContext(
      `${script.code}; ActivityRules.projectActivity(draft, snapshot)`,
      {
        structuredClone,
        draft: JSON.parse(JSON.stringify(draft)) as unknown,
        snapshot: structuredClone(snapshot),
      },
    );
    expect(browser, scenario).toEqual(server);
    expect(server.ready, scenario).toBe(true);
    expect(server.plan.length, scenario).toBeGreaterThan(0);
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toEqual(draft);
  }
});
