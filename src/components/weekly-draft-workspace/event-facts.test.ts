import { expect, test } from 'vitest';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import type { UpkeepSnapshot } from '~/lib/rules-upkeep';
import type { WeeklyDraft } from '~/lib/weekly-draft-contract';
import {
  eventSelectionFixture,
  occurrence,
} from '../../../tests/rules/event-selection-fixture';
import { eventActionFixture } from '../../../tests/rules/event-action-fixture';
import { roll } from '../../../tests/rules/upkeep-fixture';
import { eventView, type EventPreparationContext } from './event-facts';
import { derivePhaseReadiness } from './phase-readiness';

function facts(
  draft: WeeklyDraft,
  snapshot: UpkeepSnapshot,
  context?: EventPreparationContext,
) {
  const source = workspaceSourceSchema.parse({
    key: { campaignId: 'c', militiaId: 'm', draftId: draft.draftId },
    sourceRevision: 0,
    snapshot,
    people: [],
  });
  const preview = projectWeeklyDraft({
    revision: draft,
    militiaSnapshot: snapshot,
  });
  return {
    view: eventView(draft, source, preview, context),
    phases: derivePhaseReadiness(draft, source, preview, context).phases,
  };
}
const eventPhase = (phases: ReturnType<typeof facts>['phases']) =>
  phases.find((phase) => phase.phase === 'event')!;

test('[EVT-01.chance] the chance step shows raw roll, settlement adjustment, total and threshold with its breakdown', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.notoriety = 20;
  // An active refuge would soften Unfriendly; this town has none.
  snapshot.settlements[0] = {
    ...snapshot.settlements[0]!,
    reputation: 'Unfriendly',
    refugeActivatedWeek: null,
    refugeActiveUntilWeek: null,
  };
  draft.context = { ...draft.context, uneventfulCarry: true };
  draft.event.chanceRoll = roll(100, 17);
  const { chanceStep } = facts(draft, snapshot).view;
  expect(chanceStep).toMatchObject({
    applies: 'roll',
    raw: 17,
    total: 22,
    result: 'event',
    effect: 'An event happens',
    operating: { name: 'Town', reputation: 'Unfriendly', modifier: 5 },
    breakdown: [
      { label: 'Notoriety', value: 20 },
      { label: 'Uneventful last week (rank)', value: snapshot.rank },
    ],
  });
  // Equal to the chance does not trigger; the table roll never takes the adjustment.
  draft.event.chanceRoll = roll(100, 20 + snapshot.rank - 5);
  expect(facts(draft, snapshot).view.chanceStep.result).toBe('quiet');
});

test('[EVT-01.missing-reputation] an unknown operating reputation is an actionable missing input, not a zero', () => {
  const { draft, snapshot } = eventSelectionFixture();
  snapshot.settlements[0]!.reputation = null;
  const { view, phases } = facts(draft, snapshot);
  expect(view.chanceStep).toMatchObject({
    operating: { name: 'Town', modifier: null },
    total: null,
    result: null,
  });
  expect(eventPhase(phases).requirements).toContainEqual({
    id: 'event:operating-settlement',
    message:
      'Event chance: record Town’s reputation, or choose another operating settlement in Activity.',
  });
});

test('[EVT-02.collapsed] a guarantee collapses the chance step to its source; forced calm has its own explanation', () => {
  const { draft, snapshot } = eventActionFixture();
  const guaranteed = facts(draft, snapshot).view;
  expect(guaranteed.chanceStep).toMatchObject({
    applies: 'guaranteed',
    sources: [
      {
        choiceId: 'shape',
        label: expect.stringMatching(/^Guarantee Event · Action Slot \d/),
      },
    ],
  });
  expect(guaranteed.chanceStep.explanation).toContain('Guarantee Event');
  expect(guaranteed.rolled.applies).toBe(false);
  draft.context = {
    ...draft.context,
    queuedEffects: [
      {
        effectId: 'calm',
        sourceId: 'last-week',
        startsWeek: draft.week,
        endsWeek: draft.week,
        effect: { kind: 'all_is_calm' },
      },
    ],
  };
  const calm = facts(draft, snapshot).view;
  expect(calm.chanceStep.applies).toBe('forced_calm');
  expect(calm.chanceStep.explanation).toMatch(/All Is Calm/);
  // The recorded candidates stay, inactive, with their rolls.
  expect(calm.candidates).toMatchObject([
    {
      choiceId: 'shape',
      active: false,
      blocks: [
        { eventId: 'raid', status: 'not_used', table: { raw: 78 } },
        { eventId: 'theft', status: 'not_used', table: { raw: 74 } },
      ],
    },
  ]);
});

test('[EVT-04.blocks] blocks number in resolution order and name status, origin and table arithmetic', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [
    occurrence('root', 50),
    occurrence('first', 50, { kind: 'roll_twice', parentEventId: 'root' }),
    {
      ...occurrence('second', 30, {
        kind: 'roll_twice',
        parentEventId: 'root',
      }),
      tableRoll: {
        ...roll(100, 30),
        modifiers: [
          { sourceId: 'settlement', value: -5, reason: 'Old entry' },
          { sourceId: 'omen', value: 4, reason: 'Table ruling' },
        ],
      },
    },
  ];
  const { view, phases } = facts(draft, snapshot);
  const [root] = view.rolled.blocks;
  expect(root).toMatchObject({
    number: 1,
    status: 'two_more',
    statusLabel: 'Two more',
    origin: 'Rolled',
    table: { raw: 50, total: 50, name: 'Roll Twice' },
    rules: {
      name: 'Roll Twice',
      text: [
        'Roll and resolve two events.',
        'Roll Twice can only take effect once per Event phase.',
        'Additional Roll Twice results in same phase are rerolled.',
      ],
      twice: null,
    },
  });
  expect(root!.children).toMatchObject([
    {
      number: 2,
      status: 'reroll',
      statusText: 'Roll Twice again: reroll and enter the new die',
      origin: 'From Event 1 (Roll Twice)',
      children: [],
    },
    {
      number: 3,
      table: {
        raw: 30,
        total: 34,
        name: 'Festival',
        modifiers: [
          { sourceId: 'settlement', ignored: 'settlement' },
          { sourceId: 'omen', ignored: null },
        ],
      },
    },
  ]);
  expect(eventPhase(phases).requirements).toContainEqual({
    id: 'first:replacement:1',
    message:
      'Event 2 · Roll Twice: Roll Twice again: reroll and enter the new die.',
  });
});

test('[EVT-06.candidates] candidate sets name their source and keep both blocks, marking the chosen one', () => {
  const { draft, snapshot } = eventActionFixture();
  const view = facts(draft, snapshot).view;
  expect(view.candidates).toMatchObject([
    {
      choiceId: 'shape',
      active: true,
      selectedEventId: 'raid',
      blocks: [
        { eventId: 'raid', candidate: { chosen: true }, status: 'happens' },
        {
          eventId: 'theft',
          candidate: { chosen: false },
          status: 'not_chosen',
          statusLabel: 'Not chosen',
        },
      ],
    },
  ]);
  const choice = draft.activity.slots.find(
    (slot) => slot.choice?.choiceId === 'shape',
  )!.choice!;
  if (choice.actionId !== 'guarantee_event') throw new Error('fixture');
  delete choice.selectedEventId;
  const open = facts(draft, snapshot);
  expect(open.view.candidates[0]!.blocks.map((b) => b.status)).toEqual([
    'candidate',
    'candidate',
  ]);
  expect(eventPhase(open.phases).requirements).toContainEqual({
    id: 'shape:selected-event',
    message: expect.stringMatching(
      /^Guarantee Event · Action Slot \d.*: choose which event happens\.$/,
    ),
  });
});

test('[EVT-03.placeholders] missing positions show as numbered blanks, preparing until the accepted draft holds them', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.draftId = 'd';
  const accepted = new Set<string>();
  const preparing = facts(draft, snapshot, {
    acceptedEventIds: accepted,
    preparationFailed: false,
  });
  expect(preparing.view.preparation).toBe('preparing');
  expect(preparing.view.rolled.blocks).toMatchObject([
    { eventId: 'd:rolled:1', number: 1, saved: false, status: 'preparing' },
  ]);
  expect(eventPhase(preparing.phases).requirements).toContainEqual({
    id: 'event:root:1',
    message: 'The event: the rolled event is being prepared.',
  });
  const failed = facts(draft, snapshot, {
    acceptedEventIds: accepted,
    preparationFailed: true,
  });
  expect(failed.view.preparation).toBe('failed');
  expect(eventPhase(failed.phases).ready).toBe(false);
  expect(eventPhase(failed.phases).requirements).toContainEqual({
    id: 'event:root:1',
    message:
      'The event: the rolled event could not be prepared. Use Retry in Event.',
  });
});

test('[EVT-13.legacy] surplus legacy roots stay visible, need repair and are removable only once empty', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [
    occurrence('one', 10),
    occurrence('two', 80),
    { eventId: 'three', origin: { kind: 'automatic', sourceId: 'gone' } },
  ];
  const { view, phases } = facts(draft, snapshot);
  expect(view.rolled.blocks).toMatchObject([
    { eventId: 'one', status: 'needs_repair', surplus: true },
    { eventId: 'two', status: 'needs_repair', surplus: true },
  ]);
  // Clearing the roll of an otherwise empty surplus root removes it.
  expect(view.rolled.blocks[1]!.removal).toEqual({
    kind: 'event_tree',
    occurrences: [draft.event.occurrences[0], draft.event.occurrences[2]],
  });
  expect(view.inactive).toMatchObject([
    { eventId: 'three', status: 'needs_repair', surplus: true },
  ]);
  expect(eventPhase(phases).requirements.map((entry) => entry.message)).toEqual(
    expect.arrayContaining([
      'The event: more than one rolled event is recorded. Clear the extra one to remove it.',
      'Event 1: no automatic event is due from its source this week. Clear it to remove it.',
    ]),
  );
});

test('[EVT-14.outcome] the week outcome appears only when every roll and choice is complete', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [];
  expect(facts(draft, snapshot).view.outcome).toEqual({
    complete: false,
    lines: [],
  });
  draft.event.chanceRoll = roll(100, 100);
  expect(facts(draft, snapshot).view.outcome).toMatchObject({
    complete: true,
    lines: ['No event this week.', expect.stringMatching(/^Uneventful/)],
  });
});

test('[EVT-rules.view] resolved blocks carry corpus rules text; the Twice clause only on a second occurrence; blanks carry none', () => {
  const { draft, snapshot } = eventSelectionFixture();
  draft.event.occurrences = [
    occurrence('root', 50),
    occurrence('first', 90, { kind: 'roll_twice', parentEventId: 'root' }),
    occurrence('second', 90, { kind: 'roll_twice', parentEventId: 'root' }),
  ];
  const [root] = facts(draft, snapshot).view.rolled.blocks;
  const [first, second] = root!.children;
  expect(first!.rules).toEqual({
    name: 'Sickness',
    text: ['One random team becomes disabled.'],
    twice: null,
  });
  expect(second!.status).toBe('twice');
  expect(second!.rules).toEqual({
    name: 'Sickness',
    text: ['One random team becomes disabled.'],
    twice: 'team is lost unless militia succeeds on DC 20 Loyalty.',
  });
  // Inline code marks are presentation-neutral text in the view.
  draft.event.occurrences = [occurrence('root', 82)];
  expect(facts(draft, snapshot).view.rolled.blocks[0]!.rules!.text).toEqual([
    'GM presents random combat encounter at CR APL + 1.',
  ]);
  delete draft.event.occurrences[0]!.tableRoll;
  expect(facts(draft, snapshot).view.rolled.blocks[0]!.rules).toBeNull();
});
