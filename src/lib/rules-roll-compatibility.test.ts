import { expect, test } from 'vitest';
import { upkeepFixture, roll } from '../../tests/rules/upkeep-fixture';
import { projectUpkeep } from './rules-upkeep';
import type { RawRoll } from './weekly-draft-facts';
import { activityFixture } from '../../tests/rules/activity-fixture';
import { economyFixture } from '../../tests/rules/economy-fixture';
import { projectActivity } from './rules-activity';
import { weeklyDraftSchema } from './weekly-draft-contract';
import { eventAcceptanceFixtures } from '../../tests/rules/event-acceptance-fixtures';
import { projectWeeklyDraft } from './canonical-weekly-resolution';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { projectActivityAndEvents } from './rules-event-outcomes';
import { settlementFixture } from '../../tests/rules/settlement-fixture';
import { persistentEventFixture } from '../../tests/rules/persistent-event-fixture';
import { projectPersistentWeek } from './rules-persistent-events';
import { projectEventSelection } from './rules-event-selection';

const total = (
  sides: number,
  diceCount: number,
  diceTotal: number,
): RawRoll => ({
  sides,
  diceCount,
  diceTotal,
  provenance: { kind: 'table' },
  modifiers: [],
});

test.each([
  { die: 7, sides: 6, dice: [6], sum: 6, training: 24 },
  { die: 6, sides: 4, dice: [4, 4], sum: 8, training: 19 },
  { die: 20, sides: 6, dice: [6], sum: 6, training: 36 },
])(
  'Upkeep total rolls preserve attrition branch $die and its result',
  ({ die, sides, dice, sum, training }) => {
    const { draft, snapshot } = upkeepFixture();
    draft.upkeep.rolls = {
      check: roll(20, die),
      training: roll(sides, ...dice),
    };
    const legacy = projectUpkeep(draft, snapshot);
    expect(legacy.outcome.training).toBe(training);
    draft.upkeep.rolls = {
      check: total(20, 1, die),
      training: total(sides, dice.length, sum),
    };
    expect(projectUpkeep(draft, snapshot)).toEqual(legacy);
  },
);

// Test-only representation conversion; production never rewrites stored inputs.
function withTotals(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, entry: unknown) => {
      if (
        entry &&
        typeof entry === 'object' &&
        'dice' in entry &&
        Array.isArray(entry.dice) &&
        'sides' in entry
      ) {
        const { dice, ...rest } = entry;
        return {
          ...rest,
          diceCount: dice.length,
          diceTotal: dice.reduce((sum: number, die: number) => sum + die, 0),
        };
      }
      return entry;
    }),
  );
}

test.each(['drill_militia', 'dismiss_team', 'recruit_team'] as const)(
  'Activity %s keeps outcomes and check/effect timing with totals',
  (action) => {
    const { draft, snapshot } = activityFixture(action);
    const legacy = projectActivity(draft, snapshot);
    expect(legacy.ready).toBe(true);
    if (action === 'drill_militia') expect(legacy.outcome.training).toBe(37);
    const converted = weeklyDraftSchema.parse(withTotals(draft));
    expect(withTotals(projectActivity(converted, snapshot))).toEqual(
      withTotals(legacy),
    );
  },
);

test('Special Order uses the entered 2d6 delivery total', () => {
  const { draft, snapshot } = economyFixture('special_order');
  const legacy = projectActivity(draft, snapshot);
  expect(legacy.ready).toBe(true);
  expect(legacy.outcome.economy?.orders[0]?.dueDay).toBe(275);
  expect(
    withTotals(
      projectActivity(weeklyDraftSchema.parse(withTotals(draft)), snapshot),
    ),
  ).toEqual(withTotals(legacy));
});

for (const { name, input } of eventAcceptanceFixtures()) {
  test(`nested Event/Persistent ${name} keeps complete weekly resolution with totals`, () => {
    const legacy = projectWeeklyDraft(input);
    expect(legacy.requirements).toEqual([]);
    expect(legacy.status).toBe('ready');
    const revision = weeklyDraftSchema.parse(withTotals(input.revision));
    const before = structuredClone(revision);
    const { sourceKey, ...result } = projectWeeklyDraft({ ...input, revision });
    const { sourceKey: legacyKey, ...expected } = legacy;
    expect(sourceKey).not.toBe(legacyKey);
    expect(withTotals(result)).toEqual(withTotals(expected));
    expect(revision).toEqual(before);
  });
}

test('nested reactive Sabotage preserves check, notoriety and negated event with totals', () => {
  const { draft, snapshot } = eventActionFixture('sabotage');
  const legacy = projectActivityAndEvents(draft, snapshot);
  expect(legacy.event.negatedEventIds).toContain('raid');
  expect(
    withTotals(
      projectActivityAndEvents(
        weeklyDraftSchema.parse(withTotals(draft)),
        snapshot,
      ),
    ),
  ).toEqual(withTotals(legacy));
});

test('failed Reduce Danger uses a 1d4 total through the delegated settlement action', () => {
  const { draft, snapshot, choice } = settlementFixture('reduce_danger');
  choice.rolls = { check: roll(20, 1), notoriety: roll(4, 4) };
  const legacy = projectActivity(draft, snapshot);
  expect(legacy.outcome.notoriety).toBe(14);
  expect(
    withTotals(
      projectActivity(weeklyDraftSchema.parse(withTotals(draft)), snapshot),
    ),
  ).toEqual(withTotals(legacy));
});

test.each([1, 2, 14, 20])(
  'missing-team raw %i keeps loss and end-week return timing',
  (die) => {
    const { draft, snapshot } = activityFixture('lie_low');
    snapshot.roster.teams[0]!.status = 'missing';
    draft.upkeep.teamDecisions = [
      { teamId: 'team', decision: 'recover', roll: roll(20, die) },
    ];
    const legacy = projectUpkeep(draft, snapshot);
    if (die === 1) expect(legacy.outcome.roster.teams).toEqual([]);
    else if (die === 2) {
      expect(legacy.outcome.roster.teams[0]!.status).toBe('missing');
      expect(legacy.plan).not.toContainEqual({
        kind: 'team_status',
        teamId: 'team',
        status: 'active',
        timing: 'end',
      });
    } else
      expect(legacy.plan).toContainEqual({
        kind: 'team_status',
        teamId: 'team',
        status: 'active',
        timing: 'end',
      });
    expect(
      projectUpkeep(weeklyDraftSchema.parse(withTotals(draft)), snapshot),
    ).toEqual(legacy);
  },
);

test.each([19, 20])(
  'Persistent nested officer check %i keeps mitigation outcome',
  (die) => {
    const { draft, snapshot } = persistentEventFixture('rivalry');
    draft.persistent.decisions = [
      {
        eventId: 'carried',
        kind: 'mitigate',
        officerCheck: {
          characterId: 'pc',
          skill: 'diplomacy',
          skillBonus: 0,
          roll: roll(20, die),
        },
      },
    ];
    const legacy = projectPersistentWeek(draft, snapshot);
    expect(legacy.persistent.persistentEvents).toHaveLength(die === 20 ? 0 : 1);
    expect(
      withTotals(
        projectPersistentWeek(
          weeklyDraftSchema.parse(withTotals(draft)),
          snapshot,
        ),
      ),
    ).toEqual(withTotals(legacy));
  },
);

test('mixed rolls preserve modifier provenance and reserve a one-use bonus only once', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.notoriety = 100;
  snapshot.bonuses = [
    {
      bonusId: 'reward',
      source: 'Story award',
      check: 'loyalty',
      value: 2,
      availableWeek: 40,
      consumedWeek: null,
    },
  ];
  const modifiers = [
    { sourceId: 'rank-focus', value: 3, reason: 'Rank' },
    { sourceId: 'bonus:reward', value: 2, reason: 'Story award' },
    { sourceId: 'table:morale', value: 1, reason: 'Encouragement' },
  ];
  draft.upkeep.rolls = {
    check: { ...roll(20, 5), modifiers },
    training: roll(6, 1),
    notoriety: roll(20, 1),
  };
  draft.upkeep.notorietyCheck = { ...roll(20, 12), modifiers: [modifiers[1]!] };
  const legacy = projectUpkeep(draft, snapshot);
  expect(legacy.checks.map((check) => check.total)).toEqual([11, 15]);
  expect(legacy.requirements).toContain(
    'upkeep:notoriety:bonus:reward:unavailable',
  );
  expect(legacy.checkUsage.bonusIds).toEqual(['reward']);
  draft.upkeep.rolls.check = { ...total(20, 1, 5), modifiers };
  const before = structuredClone(draft);
  expect(projectUpkeep(draft, snapshot)).toEqual(legacy);
  expect(draft).toEqual(before);
  expect(snapshot.bonuses[0]!.consumedWeek).toBeNull();
});

test.each([
  { raw: undefined, requirement: 'upkeep:attrition-training:roll' },
  { raw: roll(4, 4), requirement: 'upkeep:attrition-training:dice:2d4' },
  { raw: total(4, 1, 4), requirement: 'upkeep:attrition-training:dice:2d4' },
  { raw: total(6, 2, 8), requirement: 'upkeep:attrition-training:dice:2d4' },
])(
  'Upkeep preserves missing versus incomplete requirements $requirement',
  ({ raw, requirement }) => {
    const { draft, snapshot } = upkeepFixture();
    draft.upkeep.rolls = { check: total(20, 1, 6), training: raw };
    const before = structuredClone(draft);
    const result = projectUpkeep(draft, snapshot);
    expect(result.requirements).toContain(requirement);
    expect(result.outcome.training).toBe(30);
    expect(result.warnings).not.toContain(
      'upkeep:attrition-training:roll-range',
    );
    expect(draft).toEqual(before);
  },
);

test.each([0, 9])(
  'Upkeep 2d4 total %i remains usable with an advisory',
  (value) => {
    const { draft, snapshot } = upkeepFixture();
    snapshot.training = 15;
    draft.upkeep.rolls = {
      check: total(20, 1, 6),
      training: total(4, 2, value),
    };
    const result = projectUpkeep(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('upkeep:attrition-training:roll-range');
    expect(result.outcome.training).toBe(value === 0 ? 12 : 3);
  },
);

test('legacy individual outliers retain a warning even when their sum is ordinary', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: roll(20, 6), training: roll(4, 0, 4) };
  const legacy = projectUpkeep(draft, snapshot);
  expect(legacy.warnings).toContain('upkeep:attrition-training:roll-range');
  draft.upkeep.rolls.training = total(4, 2, 4);
  const converted = projectUpkeep(draft, snapshot);
  expect(converted.outcome).toEqual(legacy.outcome);
  expect(converted.warnings).not.toContain(
    'upkeep:attrition-training:roll-range',
  );
});

test('a multi-die sum of twenty cannot supply a natural twenty or a complete d20 check', () => {
  const { draft, snapshot } = upkeepFixture();
  draft.upkeep.rolls = { check: total(20, 2, 20), training: total(6, 1, 6) };
  const result = projectUpkeep(draft, snapshot);
  expect(result.requirements).toContain('upkeep:attrition:dice:1d20');
  expect(result.outcome.training).toBe(30);
});

test.each([roll(6, 3), total(6, 1, 7), total(4, 2, 7)])(
  'Drill incomplete training retains its required 2d6 identity',
  (raw) => {
    const { draft, snapshot } = activityFixture('drill_militia');
    const choice = draft.activity.slots[0]!.choice!;
    choice.rolls = { check: total(20, 1, 10), training: raw };
    const result = projectActivity(draft, snapshot);
    expect(result.requirements).toContain('drill:training:2d6');
    expect(result.outcome.training).toBe(30);
  },
);

test.each([0, 20])(
  'Drill out-of-range total %i applies once without natural-d20 behavior',
  (value) => {
    const { draft, snapshot } = activityFixture('drill_militia');
    draft.activity.slots[0]!.choice!.rolls = {
      check: total(20, 1, 10),
      training: total(6, 2, value),
    };
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(result.warnings).toContain('drill:training:roll-range');
    expect(result.outcome.training).toBe(value === 0 ? 30 : 50);
  },
);

test('Drill legacy per-die outlier warning survives an ordinary sum', () => {
  const { draft, snapshot } = activityFixture('drill_militia');
  draft.activity.slots[0]!.choice!.rolls = {
    check: total(20, 1, 10),
    training: roll(6, 0, 6),
  };
  const result = projectActivity(draft, snapshot);
  expect(result.warnings).toContain('drill:training:roll-range');
  expect(result.outcome.training).toBe(36);
});

test.each([undefined, total(100, 2, 50), total(20, 1, 10)])(
  'Event chance missing or incompatible specs retain requirement identity',
  (raw) => {
    const { draft, snapshot } = activityFixture('lie_low');
    draft.event.chanceRoll = raw;
    const result = projectEventSelection(
      draft,
      projectActivity(draft, snapshot),
    );
    expect(result.ready).toBe(false);
    expect(result.requirements).toContain('event:chance:1d100');
  },
);

test.each([0, 101])('Event percentile total %i stays advisory', (value) => {
  const { draft, snapshot } = activityFixture('lie_low');
  draft.event.chanceRoll = roll(100, value);
  const activity = projectActivity(draft, snapshot);
  const legacy = projectEventSelection(draft, activity);
  expect(legacy.warnings).toContain('event:chance:roll-range');
  draft.event.chanceRoll = total(100, 1, value);
  expect(projectEventSelection(draft, activity)).toEqual(legacy);
});

test('Activity natural one comes from the complete raw d20, never its modified total', () => {
  const { draft, snapshot } = activityFixture('recruit_team');
  const choice = draft.activity.slots[0]!.choice!;
  choice.rolls = {
    check: {
      ...roll(20, 1),
      modifiers: [{ sourceId: 'table:aid', value: 30, reason: 'Aid' }],
    },
    notoriety: roll(6, 4),
  };
  const legacy = projectActivity(draft, snapshot);
  expect(legacy.outcome.notoriety).toBe(14);
  expect(legacy.checks[0]!.total).toBeGreaterThan(20);
  expect(
    withTotals(
      projectActivity(weeklyDraftSchema.parse(withTotals(draft)), snapshot),
    ),
  ).toEqual(withTotals(legacy));
  choice.rolls.check = total(20, 2, 1);
  const incomplete = projectActivity(draft, snapshot);
  expect(incomplete.requirements).toContain('recruit:check:1d20');
  expect(incomplete.outcome.notoriety).toBe(10);
});

test('Activity total checks consume selected one-use bonuses in the existing plan', () => {
  const { draft, snapshot } = upkeepFixture();
  snapshot.bonuses.push({
    bonusId: 'reward',
    source: 'event',
    check: 'loyalty',
    value: 4,
    availableWeek: 40,
    consumedWeek: null,
  });
  draft.activity.slots[0]!.choice = {
    choiceId: 'recruit',
    actionId: 'recruit_team',
    teamType: 'patrons',
    rolls: {
      check: {
        ...roll(20, 6),
        modifiers: [{ sourceId: 'bonus:reward', value: 4, reason: 'Reward' }],
      },
    },
  };
  const legacy = projectActivity(draft, snapshot);
  expect(legacy.checks[0]!.total).toBe(13);
  expect(legacy.plan).toContainEqual({
    kind: 'consume_bonus',
    bonusId: 'reward',
    week: 40,
  });
  expect(
    withTotals(
      projectActivity(weeklyDraftSchema.parse(withTotals(draft)), snapshot),
    ),
  ).toEqual(withTotals(legacy));
  expect(snapshot.bonuses[0]!.consumedWeek).toBeNull();
});
