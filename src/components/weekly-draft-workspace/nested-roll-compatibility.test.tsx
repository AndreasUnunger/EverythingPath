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

function total(sides: number, diceCount: number, diceTotal: number): RawRoll {
  return {
    sides,
    diceCount,
    diceTotal,
    provenance: { kind: 'table' },
    modifiers: [],
  };
}
const table = { kind: 'table' as const };
function openDetails() {
  screen
    .getByText('Edit Event 1 details')
    .parentElement!.setAttribute('open', '');
}
const textbox = (name: string) => screen.getByRole('textbox', { name });
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
function withOccurrence(
  occurrence: EventFacts['occurrences'][number]['occurrence'],
  resolvedType: string | null,
): EventFacts {
  return {
    ...eventFacts,
    occurrences: [{ ...eventFacts.occurrences[0]!, occurrence, resolvedType }],
  };
}

test('[rules.EVT-01.total] the percentile chance field reads a recorded total, blanks through the nullable edit and writes a new total with preserved metadata', () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const { rerender } = render(
    <EventView
      view={{
        ...eventFacts,
        chanceRoll: { ...total(100, 1, 0), provenance: generated },
      }}
      edit={edit}
      disabled={false}
    />,
  );
  expect(textbox('Event chance roll')).toHaveValue('0');
  expect(
    screen.getAllByText('1d100 · total of the dice only').length,
  ).toBeGreaterThan(0);
  fireEvent.change(textbox('Event chance roll'), { target: { value: '37' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_chance',
    roll: {
      diceTotal: 37,
      diceCount: 1,
      sides: 100,
      provenance: generated,
      modifiers: [],
    },
  });
  fireEvent.change(textbox('Event chance roll'), { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({ kind: 'event_chance', roll: null });
  rerender(
    <EventView
      view={{
        ...eventFacts,
        chanceRoll: {
          dice: [55],
          sides: 100,
          provenance: table,
          modifiers: [],
        },
      }}
      edit={edit}
      disabled={false}
    />,
  );
  // A complete legacy percentile shows without any write.
  expect(textbox('Event chance roll')).toHaveValue('55');
});

test('[rules.EVT-04.table-total] an occurrence table total is editable, keeps its modifiers editable and blanks through the existing occurrence save', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          tableRoll: total(100, 1, 82),
        },
        'invasion',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  expect(textbox('Event 1 table roll')).toHaveValue('82');
  fireEvent.click(screen.getByText('Event table modifiers'));
  fireEvent.click(screen.getByRole('button', { name: 'Add modifiers entry' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Helpful settlement support' }),
  );
  fireEvent.change(textbox('Value'), { target: { value: '-3' } });
  fireEvent.change(textbox('Reason'), { target: { value: 'Rain' } });
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
  fireEvent.change(textbox('Event 1 table roll'), { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: { eventId: 'root', origin: { kind: 'rolled' } },
  });
});

test('[rules.EVT-07.nested-total] a Theft occurrence’s nested check is one 1d20 total: recorded total shown, modifiers editable, blank omits the key, and no per-die or sides controls exist', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          averagePartyLevel: 5,
          rolls: { check: total(20, 1, 20) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(
    within(check).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('20');
  expect(
    within(check).getByText('1d20 · total of the dice only'),
  ).toBeVisible();
  expect(
    within(check).queryByRole('button', { name: 'Add dice entry' }),
  ).not.toBeInTheDocument();
  expect(
    within(check).queryByRole('textbox', { name: 'Sides' }),
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
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '' },
  });
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
  // Theft has no rule for a nested loss roll, so no loss control is offered.
  expect(screen.queryByRole('group', { name: 'Loss' })).not.toBeInTheDocument();
});

test('[rules.EVT-07.legacy-nested] a legacy Theft check shows its sum and a typed number writes the total form preserving metadata; a Turncoat loss is one 1d6 total', async () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
  const theft = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'theft',
    occurrence: {
      eventId: 'root',
      origin: { kind: 'rolled' as const },
      rolls: {
        check: { dice: [7], sides: 20, provenance: generated, modifiers: [] },
      },
    },
  };
  const turncoat = {
    ...eventFacts.occurrences[0]!,
    resolvedType: 'turncoat',
    occurrence: { eventId: 'second', origin: { kind: 'rolled' as const } },
  };
  render(
    <EventView
      view={{ ...eventFacts, occurrences: [theft, turncoat] }}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  screen
    .getByText('Edit Event 2 details')
    .parentElement!.setAttribute('open', '');
  const first = screen.getByRole('group', { name: 'Event 1' });
  const second = screen.getByRole('group', { name: 'Event 2' });
  const check = within(first).getByRole('group', { name: 'Check' });
  expect(
    within(check).getByRole('textbox', { name: 'Check roll' }),
  ).toHaveValue('7');
  // Theft has no nested loss; Turncoat has a 1d6 loss and no nested check.
  expect(within(first).queryByRole('group', { name: 'Loss' })).toBeNull();
  expect(within(second).queryByRole('group', { name: 'Check' })).toBeNull();
  fireEvent.click(within(second).getByRole('button', { name: 'Add rolls' }));
  const loss = within(second).getByRole('group', { name: 'Loss' });
  expect(within(loss).getByText('1d6 · total of the dice only')).toBeVisible();
  fireEvent.change(within(loss).getByRole('textbox', { name: 'Loss roll' }), {
    target: { value: '4' },
  });
  fireEvent.click(
    within(second).getByRole('button', { name: 'Save occurrence' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'second',
        origin: { kind: 'rolled' },
        rolls: { loss: total(6, 1, 4) },
      },
    }),
  );
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '15' },
  });
  fireEvent.click(
    within(first).getByRole('button', { name: 'Save occurrence' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        rolls: {
          check: {
            diceTotal: 15,
            diceCount: 1,
            sides: 20,
            provenance: generated,
            modifiers: [],
          },
        },
      },
    }),
  );
});

test('[rules.EVT-11.unresolved] an unresolved occurrence keeps its recorded nested roll read-only with removal only, while its table roll stays editable', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(20, 1, 12) },
        },
        null,
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  expect(
    within(check).queryByRole('textbox', { name: 'Check roll' }),
  ).not.toBeInTheDocument();
  expect(within(check).getByText('12')).toBeVisible();
  expect(
    within(check).getByText(/no rule specification in the current context/),
  ).toBeVisible();
  expect(textbox('Event 1 table roll')).toBeEnabled();
  fireEvent.click(within(check).getByRole('button', { name: 'Remove check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: { eventId: 'root', origin: { kind: 'rolled' }, rolls: {} },
    }),
  );
});

test('[rules.EVT-11.malformed-nested] malformed nested text blocks the enclosing Save with a styled error instead of saving the prior number', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={withOccurrence(
        {
          eventId: 'root',
          origin: { kind: 'rolled' },
          rolls: { check: total(20, 1, 12) },
        },
        'theft',
      )}
      edit={edit}
      disabled={false}
    />,
  );
  openDetails();
  const check = screen.getByRole('group', { name: 'Check' });
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '1e2' },
  });
  expect(within(check).getByRole('alert')).toHaveTextContent(
    'Use digits only.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent?.includes('Use digits only.')),
    ).toBe(true),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(within(check).getByRole('textbox', { name: 'Check roll' }), {
    target: { value: '13' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'event_occurrence',
      occurrence: {
        eventId: 'root',
        origin: { kind: 'rolled' },
        rolls: { check: total(20, 1, 13) },
      },
    }),
  );
});

test('[rules.PER-04.total] a Persistent Rivalry officer check is one 1d20 total that keeps its officer fields and metadata', async () => {
  const edit = vi.fn();
  const generated = { kind: 'generated' as const, sourceId: 'roller' };
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
        roll: { ...total(20, 1, 20), provenance: generated },
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
  expect(textbox('Roll')).toHaveValue('20');
  expect(screen.getByRole('button', { name: 'Aubrin' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(textbox('Skill Bonus')).toHaveValue('2');
  fireEvent.click(
    screen.getByRole('button', { name: 'Save persistent decision' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'persistent_decision',
      decision: event.decision,
    }),
  );
  fireEvent.change(textbox('Roll'), { target: { value: '19' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save persistent decision' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'persistent_decision',
      decision: {
        kind: 'mitigate',
        eventId: 'rivalry',
        officerCheck: {
          characterId: 'pc',
          skill: 'diplomacy',
          skillBonus: 2,
          roll: {
            diceTotal: 19,
            diceCount: 1,
            sides: 20,
            provenance: generated,
            modifiers: [],
          },
        },
      },
    }),
  );
});
