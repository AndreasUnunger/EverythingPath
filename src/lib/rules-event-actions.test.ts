import { expect, test } from 'vitest';
import { projectActivity } from './rules-activity';
import { projectActivityAndEventShaping as project } from './rules-event-shaping';
import { eventActionFixture } from '../../tests/rules/event-action-fixture';
import { characterFixture } from '../../tests/rules/character-fixture';
import { roll } from '../../tests/rules/upkeep-fixture';
import { weeklyDraftSchema } from './weekly-draft-contract';

test('[rules.A05.next] augmentation follows the next actual choice and recomputes on moving and clearing', () => {
  const { draft, snapshot } = eventActionFixture('covert_action');
  draft.activity.slots.splice(1, 0, { slotId: 'empty', choice: null });
  draft.rulesExceptions.push({
    exceptionId: 'capacity',
    subjectId: 'drill',
    ruleId: 'action-capacity',
    reason: 'Extra slot',
  });
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(16);
  expect(
    result.checks[0]?.modifiers.filter((entry) =>
      entry.source.startsWith('covert:'),
    ),
  ).toEqual([{ source: 'covert:shape', value: 3 }]);
  draft.activity.slots[1]!.choice = {
    choiceId: 'intervening',
    actionId: 'change_officer_role',
    characterId: 'pc',
    toRole: 'spymaster',
  };
  expect(projectActivity(draft, snapshot).requirements).toContain(
    'shape:immediately-following-choice',
  );
  draft.activity.slots[0]!.choice = null;
  expect(
    projectActivity(draft, snapshot).checks[0]?.modifiers.some((entry) =>
      entry.source.startsWith('covert:'),
    ),
  ).toBe(false);
});
test('[rules.A05.success] natural one is successful with sufficient bonus and suppresses only target notoriety', () => {
  const { draft, snapshot } = eventActionFixture('covert_action');
  snapshot.characters[0]!.charisma = 40;
  draft.activity.slots[1]!.choice!.rolls = {
    check: roll(20, 1),
    training: roll(6, 2, 4),
  };
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.training).toBe(36);
  expect(result.outcome.notoriety).toBe(10);
  expect(result.actionResults[1]?.succeeded).toBe(true);
});
test('[rules.A05.failure] failed targets retain natural-one notoriety and duplicate action types never share augmentation', () => {
  const { draft, snapshot } = eventActionFixture('covert_action');
  draft.activity.slots[1]!.choice!.rolls = {
    check: roll(20, 1),
    notoriety: roll(6, 4),
  };
  let result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.notoriety).toBe(14);
  expect(result.actionResults[1]?.succeeded).toBe(false);
  draft.activity.slots.push({
    slotId: 'third',
    choice: {
      choiceId: 'again',
      actionId: 'drill_militia',
      rolls: { check: roll(20, 1), notoriety: roll(6, 2) },
    },
  });
  for (const ruleId of ['action-capacity', 'drill-limit'])
    draft.rulesExceptions.push({
      exceptionId: ruleId,
      subjectId: 'again',
      ruleId,
      reason: 'Table exception',
    });
  result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(result.outcome.notoriety).toBe(16);
  expect(result.checks[1]?.total).toBe(4);
});
test('[rules.A05.contact] contacts and caches require a site and receipt and last only this week', () => {
  for (const mode of ['contact', 'cache'] as const) {
    const { draft, snapshot, choice } = eventActionFixture('covert_action');
    if (choice.actionId !== 'covert_action') throw Error('fixture');
    choice.mode = mode;
    choice.location = 'Fort';
    const result = projectActivity(draft, snapshot);
    expect(result.ready).toBe(true);
    expect(
      result.plan.find((effect) => effect.kind === 'covert_site'),
    ).toMatchObject({
      mode,
      location: 'Fort',
      availableWeek: 40,
      expiresWeek: 40,
    });
    delete choice.location;
    expect(projectActivity(draft, snapshot).requirements).toContain(
      'shape:location',
    );
  }
});
test('[rules.A05.raid] Covert composes with the explicit next-week Raid rescue DC', () => {
  const { draft, snapshot } = characterFixture('rescue_character');
  snapshot.characterActions!.people[0]!.capture = {
    source: 'raid',
    week: draft.week - 1,
  };
  snapshot.roster.teams.push({
    ...snapshot.roster.teams[0]!,
    teamId: 'spies',
    teamType: 'spies',
    managerCharacterId: 'pc',
  });
  snapshot.characters[0]!.charisma = 16;
  draft.activity.slots.unshift({
    slotId: 'covert',
    choice: {
      choiceId: 'covert',
      actionId: 'covert_action',
      teamId: 'spies',
      mode: 'augment',
      followingChoiceId: 'character',
    },
  });
  const result = projectActivity(draft, snapshot);
  expect(result.ready).toBe(true);
  expect(
    result.plan.find((effect) => effect.kind === 'rescue_result'),
  ).toMatchObject({ dc: 8, succeeded: true });
  expect(result.outcome.notoriety).toBe(snapshot.notoriety);
});
test('[rules.A10.cost] each occurrence pays its own minimum treasury and notoriety dice', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  const again = structuredClone(choice);
  if (again.actionId !== 'guarantee_event') throw Error('fixture');
  again.choiceId = 'again';
  again.candidates = again.candidates!.map((event) => ({
    ...event,
    eventId: `again-${event.eventId}`,
  }));
  again.selectedEventId = 'again-raid';
  again.acknowledgements = [
    {
      acknowledgementId: 'again',
      subjectId: 'guarantee_event:again',
      outcome: 'Second choice',
    },
  ];
  draft.activity.slots[1]!.choice = again;
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  const { activity, event } = project(draft, snapshot);
  expect(event.ready).toBe(true);
  expect(activity.outcome.treasuryCopper).toBe(24000);
  expect(activity.outcome.notoriety).toBe(16);
  expect(event.selected.map((event) => event.eventId)).toEqual([
    'raid',
    'again-raid',
  ]);
});
test('[rules.A10.choice] both raw rolls and a root selection are mandatory and cleared guarantees leave no stale benefit', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  expect(project(draft, snapshot).event.ready).toBe(true);
  delete choice.candidates![1]!.tableRoll;
  expect(project(draft, snapshot).event.requirements).toContain(
    'theft:table:1d100',
  );
  delete choice.selectedEventId;
  expect(project(draft, snapshot).event.requirements).toContain(
    'shape:selected-event',
  );
  draft.activity.slots[0]!.choice = null;
  draft.event.chanceRoll = roll(100, 100);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    guaranteed: false,
    selected: [],
  });
});
test('[rules.A10.roll-twice] selected Roll Twice expands once and repeats require independent replacement rolls', () => {
  const { draft, snapshot, choice } = eventActionFixture();
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  choice.candidates![0]!.tableRoll = roll(100, 50);
  expect(project(draft, snapshot).event.requirements).toContain(
    'raid:roll_twice:2',
  );
  choice.candidates!.push(
    {
      eventId: 'child-one',
      origin: { kind: 'roll_twice', parentEventId: 'raid' },
      tableRoll: roll(100, 50),
    },
    {
      eventId: 'child-two',
      origin: { kind: 'roll_twice', parentEventId: 'raid' },
      tableRoll: roll(100, 78),
    },
  );
  expect(project(draft, snapshot).event.requirements).toContain(
    'child-one:replacement:1',
  );
  choice.candidates!.push({
    eventId: 'replacement',
    origin: { kind: 'replacement', parentEventId: 'child-one' },
    tableRoll: roll(100, 74),
  });
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    selected: [
      { eventId: 'replacement', eventType: 'theft' },
      { eventId: 'child-two', eventType: 'raid' },
    ],
  });
});
test('[rules.A10.precedence] forced All Is Calm suppresses selections while keeping Activity expenditure', () => {
  const { draft, snapshot } = eventActionFixture();
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'calm',
        sourceId: 'last-week',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'all_is_calm' },
      },
    ],
  };
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  const { activity, event } = project(draft, snapshot);
  expect(event).toMatchObject({ ready: true, guaranteed: true, selected: [] });
  expect(activity.outcome.treasuryCopper).toBe(27000);
});
test('[rules.A13.team] Guardians must be assigned and eligible', () => {
  const { draft, snapshot, choice } = eventActionFixture('manipulate_events');
  expect(project(draft, snapshot).event.ready).toBe(true);
  snapshot.roster.teams[0]!.status = 'disabled';
  expect(project(draft, snapshot).event.requirements).toContain(
    'shape:team-condition:exception',
  );
  delete choice.teamId;
  expect(project(draft, snapshot).event.requirements).toContain('shape:team');
});
test('[rules.A13.chooser] manager selects or a randomly chosen PC is explicitly recorded', () => {
  const { draft, snapshot, choice } = eventActionFixture('manipulate_events');
  if (choice.actionId !== 'manipulate_events') throw Error('fixture');
  expect(project(draft, snapshot).event.guarantees[0]?.chooser).toEqual({
    kind: 'manager',
    characterId: 'pc',
  });
  snapshot.roster.teams[0]!.managerCharacterId = null;
  expect(project(draft, snapshot).event.requirements).toContain(
    'shape:chooser',
  );
  choice.chooserCharacterId = 'pc';
  expect(project(draft, snapshot).event.guarantees[0]?.chooser).toEqual({
    kind: 'random_pc',
    characterId: 'pc',
  });
});
test('[rules.A13.composition] Manipulate and Guarantee retain independent selections in action order', () => {
  const { draft, snapshot } = eventActionFixture('manipulate_events');
  const other = eventActionFixture().choice;
  if (other.actionId !== 'guarantee_event') throw Error('fixture');
  other.choiceId = 'paid';
  other.candidates = other.candidates!.map((event) => ({
    ...event,
    eventId: `paid-${event.eventId}`,
  }));
  other.selectedEventId = 'paid-theft';
  other.acknowledgements = [
    {
      acknowledgementId: 'paid',
      subjectId: 'guarantee_event:paid',
      outcome: 'Recorded',
    },
  ];
  draft.activity.slots[1]!.choice = other;
  const { event } = project(draft, snapshot);
  expect(event.ready).toBe(true);
  expect(event.selected.map((entry) => entry.eventType)).toEqual([
    'raid',
    'theft',
  ]);
});
test('[rules.A18.availability] unavailable or already employed Saboteurs cannot react', () => {
  for (const status of ['missing', 'disabled'] as const) {
    const { draft, snapshot } = eventActionFixture('sabotage');
    snapshot.roster.teams[0]!.status = status;
    expect(project(draft, snapshot).event).toMatchObject({
      ready: false,
      negatedEventIds: [],
      sabotage: [],
    });
  }
  const { draft, snapshot } = eventActionFixture('sabotage');
  draft.activity.slots[1]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    teamId: 'team',
    instruction: 'Scout',
    costCopper: 0,
    acknowledgements: [
      { acknowledgementId: 'work', subjectId: 'special:work', outcome: 'Done' },
    ],
  };
  expect(project(draft, snapshot).event.requirements).toContain(
    'react:team-action-limit:exception',
  );
  snapshot.roster.teams = [];
  expect(project(draft, snapshot).event.requirements).toContain('react:team');
});
test('[rules.A18.success] DC boundary negates the exact event and adds notoriety on success', () => {
  const { draft, snapshot } = eventActionFixture('sabotage');
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.sabotage[0]).toMatchObject({
    eventId: 'raid',
    total: 18,
    dc: 18,
    succeeded: true,
    notoriety: 4,
  });
  expect(result.negatedEventIds).toEqual(['raid']);
  expect(result.outcome.notoriety).toBe(17);
});
test('[rules.A18.failure] failed reaction still adds its die and unselected candidates cannot react', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  choice.candidates![0]!.sabotage!.rolls!.check = roll(20, 13);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    negatedEventIds: [],
    outcome: { notoriety: 17 },
  });
  choice.selectedEventId = 'theft';
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    sabotage: [],
    outcome: { notoriety: 13 },
  });
});
test('[rules.A18.composition] queued, manager, and Overseer modifiers compose once with occurrence-specific raw facts', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  snapshot.roster.officers = [{ role: 'overseer', characterId: 'pc' }];
  snapshot.characters[0]!.intelligence = 16;
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'queued',
        sourceId: 'source',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'check_modifier', check: 'secrecy', value: -2 },
      },
    ],
  };
  const sabotage = choice.candidates![0]!.sabotage!;
  sabotage.overseerCharacterId = 'pc';
  sabotage.rolls!.check!.modifiers = [
    'manager:pc',
    'queued:source',
    'overseer-support',
    'officers',
    'rank-focus',
  ].map((sourceId) => ({
    sourceId,
    value: 100,
    reason: 'Stale computed display',
  }));
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.checks[0]?.total).toBe(20);
  expect(result.checks[0]?.modifiers).toEqual([
    { source: 'rank-focus', value: 1 },
    { source: 'officers', value: 1 },
    { source: 'manager:pc', value: 3 },
    { source: 'overseer-support', value: 3 },
    { source: 'queued:source', value: -2 },
  ]);
  delete sabotage.rolls!.notoriety;
  expect(project(draft, snapshot).event.requirements).toContain(
    'react:notoriety:1d6',
  );
  delete sabotage.rolls!.check;
  expect(project(draft, snapshot).event.requirements).toContain(
    'react:check:1d20',
  );
});
test('[rules.A18.automatic] automatic occurrences retain their source and reactive result independently of the normal roll', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  const raid = choice.candidates![0]!;
  draft.activity.slots[0]!.choice = null;
  draft.event = {
    chanceRoll: roll(100, 100),
    occurrences: [
      { ...raid, origin: { kind: 'automatic', sourceId: 'storm' } },
    ],
  };
  expect(project(draft, snapshot).event.requirements).toContain(
    'raid:automatic-event-source',
  );
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'storm-roll',
        sourceId: 'storm',
        startsWeek: 40,
        endsWeek: 40,
        effect: { kind: 'automatic_events', count: 1 },
      },
    ],
  };
  expect(weeklyDraftSchema.safeParse(draft).success).toBe(true);
  expect(project(draft, snapshot).event).toMatchObject({
    ready: true,
    selected: [{ eventId: 'raid' }],
    negatedEventIds: ['raid'],
    outcome: { notoriety: 14 },
  });
  draft.event.occurrences[0]!.tableRoll = roll(100, 50);
  expect(project(draft, snapshot).event.requirements).toContain(
    'raid:replacement:1',
  );
});
test('[rules.A18.carried] recorded carried penalties do not duplicate the computed Event modifier', () => {
  const { draft, snapshot, choice } = eventActionFixture('sabotage');
  if (choice.actionId !== 'guarantee_event') throw Error('fixture');
  draft.context = {
    ...draft.context,
    persistentPhaseEligible: true,
    carriedEvents: [
      {
        eventId: 'agent',
        eventType: 'double_agent',
        startedWeek: 39,
        order: 0,
        targets: [],
      },
      {
        eventId: 'agent-two',
        eventType: 'double_agent',
        startedWeek: 39,
        order: 1,
        targets: [],
      },
    ],
  };
  const sabotage = choice.candidates![0]!.sabotage!;
  sabotage.rolls!.check = roll(20, 16);
  sabotage.rolls!.check.modifiers = ['agent', 'agent-two', 'queued:agent'].map(
    (sourceId) => ({ sourceId, value: -2, reason: 'Recorded carried penalty' }),
  );
  const result = project(draft, snapshot).event;
  expect(result.ready).toBe(true);
  expect(result.sabotage[0]).toMatchObject({ total: 18, succeeded: true });
});
