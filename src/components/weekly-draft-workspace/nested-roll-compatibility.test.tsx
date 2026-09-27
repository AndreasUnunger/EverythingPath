import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { EventView } from './event-view';
import { PersistentView } from './persistent-view';
import type {
  EventView as EventFacts,
  PersistentView as PersistentFacts,
} from './types';
afterEach(cleanup);

// Test-only representation; the app never writes totals in this delivery.
function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
function openDetails() {
  screen
    .getByText('Edit Event 1 details')
    .parentElement!.setAttribute('open', '');
}
const eventFacts: EventFacts = {
  phase: 'event',
  ready: false,
  chance: 10,
  chanceRoll: null,
  chanceModifier: 0,
  guaranteed: false,
  occurrences: [
    {
      occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
      resolvedType: null,
      optionalMitigation: 'unavailable',
      changes: [],
      exceptionChoices: [],
      rollSides: { check: 20, roll: 20, loss: 6, notoriety: 6 },
      mode: null,
      selected: false,
      negated: false,
      owner: null,
      requirements: [],
      warnings: [],
    },
  ],
  acknowledgements: [],
  exceptions: [],
  checks: [],
  options: {
    modifierSources: [
      { value: 'helpful', label: 'Helpful settlement support' },
    ],
  },
  requirements: [],
  warnings: [],
};

test('[rules.EVT-01.total] a percentile chance total is read honestly and clears through the existing nullable edit before legacy re-entry', () => {
  const edit = vi.fn();
  const { rerender } = render(
    <EventView
      view={{ ...eventFacts, chanceRoll: total(100, 1, 0) }}
      edit={edit}
      disabled={false}
    />,
  );
  const group = screen.getByRole('group', { name: 'Event chance roll' });
  expect(within(group).getByText('0')).toBeVisible();
  expect(within(group).getByText('1d100')).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: 'Event chance roll' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(group).getByRole('button', { name: 'Clear event chance roll' }),
  );
  expect(edit).toHaveBeenLastCalledWith({ kind: 'event_chance', roll: null });
  rerender(<EventView view={eventFacts} edit={edit} disabled={false} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Event chance roll' }), {
    target: { value: '37' },
  });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_chance',
    roll: {
      dice: [37],
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    },
  });
});

test('[rules.EVT-04.table-total] an occurrence table total is shown, keeps its modifiers editable and clears through the existing occurrence save', async () => {
  const edit = vi.fn();
  const occurrence = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'invasion',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      tableRoll: total(100, 1, 82),
    },
  };
  render(
    <EventView
      view={{ ...eventFacts, occurrences: [occurrence] }}
      edit={edit}
      disabled={false}
    />,
  );
  const group = screen.getByRole('group', { name: 'Event 1 table roll' });
  expect(within(group).getByText('82')).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: 'Event 1 table roll' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Event table modifiers'));
  fireEvent.click(screen.getByRole('button', { name: 'Add modifiers entry' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Helpful settlement support' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
    target: { value: '-3' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Rain' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save modifiers' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        tableRoll: {
          ...total(100, 1, 82),
          modifiers: [{ sourceId: 'helpful', value: -3, reason: 'Rain' }],
        },
      },
    }),
  );
  fireEvent.click(
    within(group).getByRole('button', { name: 'Clear event 1 table roll' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
  });
});

test('[rules.WEEK-18.nested-total] a nested Event detail roll recorded as a total is displayed, keeps modifier edits, saves unchanged and is removable without dropping sibling fields', async () => {
  const edit = vi.fn();
  const occurrence = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'theft',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      averagePartyLevel: 5,
      rolls: { check: total(20, 1, 20) },
    },
  };
  render(
    <EventView
      view={{ ...eventFacts, occurrences: [occurrence] }}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(within(check).getByText('Recorded total')).toBeVisible();
  expect(within(check).getByText('20')).toBeVisible();
  expect(within(check).getByText('1d20')).toBeVisible();
  expect(
    within(check).queryByRole('button', { name: 'Add dice entry' }),
  ).not.toBeInTheDocument();
  expect(
    within(check).queryByRole('textbox', { name: 'Dice Total' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(check).getByRole('button', { name: 'Add modifiers entry' }),
  );
  fireEvent.click(
    within(check).getByRole('button', { name: 'Helpful settlement support' }),
  );
  fireEvent.change(within(check).getByRole('textbox', { name: 'Value' }), {
    target: { value: '1' },
  });
  fireEvent.change(within(check).getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Allies' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        averagePartyLevel: 5,
        rolls: {
          check: {
            ...total(20, 1, 20),
            modifiers: [{ sourceId: 'helpful', value: 1, reason: 'Allies' }],
          },
        },
      },
    }),
  );
  fireEvent.click(within(check).getByRole('button', { name: 'Remove check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        averagePartyLevel: 5,
        rolls: {},
      },
    }),
  );
  // Deliberate legacy re-entry stays available after the removal.
  expect(screen.getByRole('button', { name: 'Add check' })).toBeVisible();
});

test('[rules.PER-04.total] a Persistent officer check with a recorded total keeps its officer fields and saves the total unchanged', async () => {
  const edit = vi.fn();
  const event: PersistentFacts['events'][number] = {
    eventId: 'rivalry',
    eventType: 'rivalry',
    startedWeek: 1,
    order: 0,
    targets: [],
    name: 'Rivalry · Event 1',
    ageWeeks: 3,
    targetNames: [],
    decision: {
      kind: 'mitigate',
      eventId: 'rivalry',
      officerCheck: {
        characterId: 'pc',
        skill: 'diplomacy',
        skillBonus: 2,
        roll: total(20, 1, 20),
      },
    },
    ended: false,
    changes: [],
    checks: [],
    exceptions: [],
    requirements: [],
    warnings: [],
  };
  render(
    <PersistentView
      view={{
        phase: 'persistent',
        ready: true,
        firstBuyoff: true,
        nextBuyoffWeek: 4,
        buyoffCostCopper: 4000,
        options: { characterId: [{ value: 'pc', label: 'Aubrin' }] },
        events: [event],
        requirements: [],
        warnings: [],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  const roll = screen.getByRole('group', { name: 'Roll' });
  expect(within(roll).getByText('20')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Aubrin' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(screen.getByRole('textbox', { name: 'Skill Bonus' })).toHaveValue('2');
  fireEvent.click(
    screen.getByRole('button', { name: 'Save persistent decision' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'persistent_decision',
      decision: event.decision,
    }),
  );
});

test('[rules.WEEK-18.legacy-nested] an absent nested roll still offers the legacy writer and a legacy array keeps its dice entries', () => {
  const occurrence = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'theft',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      rolls: {
        check: {
          dice: [7],
          sides: 20,
          provenance: { kind: 'table' as const },
          modifiers: [],
        },
      },
    },
  };
  render(
    <EventView
      view={{ ...eventFacts, occurrences: [occurrence] }}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(within(check).getByRole('textbox', { name: 'Entry 1' })).toHaveValue(
    '7',
  );
  expect(
    within(check).getByRole('button', { name: 'Add dice entry' }),
  ).toBeVisible();
  expect(within(check).queryByText('Recorded total')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add notoriety' })).toBeVisible();
});
