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
  CANONICAL_WEEKLY_RULESET_VERSION,
  projectWeeklyDraft,
  resolveReviewedWeeklyDraft,
  prepareCanonicalResolutionRecord,
} from '../src/lib/canonical-weekly-resolution';
import { persistentEventFixture } from '../tests/rules/persistent-event-fixture';
import {
  childEvent,
  guaranteedWeek,
} from '../tests/rules/candidate-reroll-fixture';
import { occurrence } from '../tests/rules/event-selection-fixture';
import { roll } from '../tests/rules/upkeep-fixture';
const modules = import.meta.glob('./**/*.ts');

async function loadBrowserRules() {
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
  return script.code;
}

function prepareProjectionFixture(
  kind: 'low_morale' | 'theft' | 'rivalry',
  totalForm: boolean,
) {
  const { draft, snapshot } = persistentEventFixture(kind);
  snapshot.training = 15;
  if (kind === 'low_morale') {
    snapshot.bonuses = [
      {
        bonusId: 'gift',
        source: 'reward',
        check: 'any',
        value: 5,
        phase: 'activity',
        availableWeek: 2,
        consumedWeek: null,
      },
    ];
    draft.activity.consumableIds = ['gift'];
    draft.activity.slots = [
      {
        slotId: 'one',
        choice: {
          choiceId: 'drill',
          actionId: 'drill_militia',
          consumableIds: ['gift'],
          rolls: { check: roll(20, 10), training: roll(6, 3, 4) },
        },
      },
    ];
  }
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
  const legacyPreview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  if (totalForm) {
    draft.upkeep.rolls.check = {
      diceTotal: 19,
      diceCount: 1,
      sides: 20,
      provenance: { kind: 'table' },
      modifiers: [],
    };
    const drill = draft.activity.slots[0]?.choice;
    if (kind === 'low_morale' && drill?.actionId === 'drill_militia') {
      drill.rolls = {
        ...drill.rolls,
        training: {
          diceTotal: 7,
          diceCount: 2,
          sides: 6,
          provenance: { kind: 'table' },
          modifiers: [],
        },
      };
    }
  }
  return { draft, snapshot, legacyPreview };
}

test('[rules.P78.projection-parity] browser and persisted Convex source yield the same complete preview and immutable source/outcome', async () => {
  const browserRules = await loadBrowserRules();
  for (const [kind, totalForm] of (
    ['low_morale', 'theft', 'rivalry'] as const
  ).flatMap(
    (kind) =>
      [
        [kind, false],
        [kind, true],
      ] as const,
  )) {
    const { draft, snapshot, legacyPreview } = prepareProjectionFixture(
      kind,
      totalForm,
    );
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
      `${browserRules}; WeeklyRules.projectWeeklyDraft(input)`,
      {
        structuredClone,
        input: JSON.parse(
          JSON.stringify({ revision: draft, militiaSnapshot: snapshot }),
        ) as unknown,
      },
    );
    expect(browser, kind).toEqual(server);
    expect(server.status, kind).toBe('ready');
    expect(server.outcome, `${kind} preserves legacy outcomes`).toEqual(
      legacyPreview.outcome,
    );
    expect(server.requirements).toEqual(legacyPreview.requirements);
    expect(server.warnings).toEqual(legacyPreview.warnings);
    if (totalForm) expect(server.sourceKey).not.toBe(legacyPreview.sourceKey);

    expect(server.outcome?.militiaSnapshot.treasuryCopper).toBe(
      kind === 'low_morale' ? 21003 : 24003,
    );
    if (kind === 'low_morale') {
      expect(server.outcome?.militiaSnapshot.training).toBe(21);
      expect(server.outcome?.militiaSnapshot.bonuses[0]?.consumedWeek).toBe(2);
    }
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
    expect(record.source).toEqual(draft);
    expect(record.adjudication.tableAdjustments[0]?.reason).toBe(
      'Three copper found at the table',
    );
    expect(await player.run((ctx) => readOpenDraft(ctx, scope))).toBeNull();
  }
});

test('[rules.A10.reroll-parity] browser preview and Convex Confirmation agree that a candidate Roll Twice is rerolled in place, under the current Ruleset Version', async () => {
  const browserRules = await loadBrowserRules();
  const scenarios = {
    // A chosen candidate's Roll Twice, with children an earlier version added.
    expanded: guaranteedWeek(
      [
        occurrence('pick', 50),
        occurrence('other', 46),
        childEvent('pick/twice/1', 10, 'roll_twice', 'pick'),
        childEvent('pick/twice/2', 46, 'roll_twice', 'pick'),
      ],
      'pick',
    ),
    // The candidate not chosen rolls Roll Twice.
    unchosen: guaranteedWeek(
      [occurrence('pick', 10), occurrence('other', 51)],
      'pick',
    ),
    // Rerolled in its own die; the earlier children stay unused.
    rerolled: guaranteedWeek(
      [
        occurrence('pick', 10),
        occurrence('other', 46),
        childEvent('pick/twice/1', 10, 'roll_twice', 'pick'),
        childEvent('pick/twice/2', 46, 'roll_twice', 'pick'),
      ],
      'pick',
    ),
  };
  for (const [name, input] of Object.entries(scenarios)) {
    const { revision: draft, militiaSnapshot: snapshot } = input;
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
      `${browserRules}; WeeklyRules.projectWeeklyDraft(input)`,
      {
        structuredClone,
        input: JSON.parse(
          JSON.stringify({ revision: draft, militiaSnapshot: snapshot }),
        ) as unknown,
      },
    );
    expect(browser, name).toEqual(server);
    expect(server.rulesetVersion, name).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
    if (name !== 'rerolled') {
      expect(server.status, name).toBe('incomplete');
      expect(server.requirements, name).toContain(
        `${name === 'expanded' ? 'pick' : 'other'}:replacement:1`,
      );
      continue;
    }
    expect(server.status).toBe('ready');
    expect(server.phases?.event.selected.map((event) => event.eventId)).toEqual(
      ['pick'],
    );
    // Confirmation records the same outcome under the current version and
    // keeps the unused earlier children in its source.
    const record = await player.run(async (ctx) => {
      const revision = await readOpenDraft(ctx, scope);
      if (!revision) throw Error('Missing source');
      const record = prepareCanonicalResolutionRecord(
        resolveReviewedWeeklyDraft(
          { revision, militiaSnapshot: snapshot },
          server.sourceKey,
        ),
        'record-rerolled',
      );
      await appendResolutionRecord(ctx, { ...scope, record });
      return record;
    });
    expect(record.rulesetVersion).toBe(CANONICAL_WEEKLY_RULESET_VERSION);
    expect(record.finalOutcome.data).toEqual(
      JSON.parse(JSON.stringify(server.outcome)),
    );
    expect(record.source).toEqual(draft);
  }
});
