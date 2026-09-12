import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EventView } from './event-view';
import type { EventView as Facts } from './types';
afterEach(cleanup);
const view: Facts = {
  phase: 'event',
  ready: false,
  chance: 10,
  chanceRoll: null,
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
      requirements: ['root:table:1d100'],
      warnings: [],
    },
  ],
  acknowledgements: [],
  exceptions: [],
  checks: [],
  options: {},
  requirements: ['event:chance:1d100', 'root:table:1d100'],
  warnings: [],
};
test('[rules.P83.input] percentile input rejects malformed text and distinguishes zero and clear', () => {
  const edit = vi.fn();
  render(<EventView view={view} edit={edit} disabled={false} />);
  const input = screen.getByRole('textbox', { name: 'Event chance roll' });
  fireEvent.change(input, { target: { value: '1e2' } });
  expect(input).toHaveValue('');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '0' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_chance',
    roll: {
      dice: [0],
      sides: 100,
      provenance: { kind: 'table' },
      modifiers: [],
    },
  });
  fireEvent.change(input, { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({ kind: 'event_chance', roll: null });
});
test('[rules.P83.acknowledgement] event notes use the occurrence subject and an explicit clear', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={{
        ...view,
        occurrences: [
          {
            ...view.occurrences[0]!,
            resolvedType: 'invasion',
            requirements: ['root:acknowledgement'],
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Event outcome acknowledgement' }),
    { target: { value: 'The table repelled the invaders.' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save event outcome acknowledgement' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'acknowledge',
      acknowledgement: {
        acknowledgementId: expect.any(String),
        subjectId: 'event:root',
        outcome: 'The table repelled the invaders.',
      },
    }),
  );
});

test('[rules.P83.details] target checks default percentile capture dice and preserve explicit omission when clearing', async () => {
  const edit = vi.fn();
  const occurrence = {
    ...view.occurrences[0]!,
    resolvedType: 'raid',
    rollSides: { check: 20, loss: 100, roll: 20 },
    occurrence: {
      ...view.occurrences[0]!.occurrence,
      targets: [{ kind: 'character' as const, characterId: 'person' }],
      averagePartyLevel: 5,
    },
  };
  render(
    <EventView
      view={{
        ...view,
        occurrences: [occurrence],
        options: { characterId: [{ value: 'person', label: 'Nora' }] },
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add target checks' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Add target checks entry' }),
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Character' }).at(-1)!);
  const nora = screen.getAllByRole('button', { name: 'Nora' });
  fireEvent.click(nora[nora.length - 1]!);
  // The target check's rolls are separate from the event-level optional rolls.
  const addRolls = screen.getAllByRole('button', {
    name: 'Add rolls',
  });
  fireEvent.click(addRolls[addRolls.length - 1]!);
  fireEvent.click(screen.getByRole('button', { name: 'Add loss' }));
  expect(screen.getByRole('textbox', { name: 'Sides' })).toHaveValue('100');
  fireEvent.click(screen.getByRole('button', { name: 'Add dice entry' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Entry 1' }), {
    target: { value: '0' },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Average Party Level' }),
    { target: { value: '' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'event_occurrence',
      occurrence: expect.objectContaining({
        targetChecks: [
          {
            target: { kind: 'character', characterId: 'person' },
            rolls: {
              loss: {
                dice: [0],
                sides: 100,
                provenance: { kind: 'table' },
                modifiers: [],
              },
            },
          },
        ],
      }),
    }),
  );
  expect(edit.mock.lastCall?.[0].occurrence).not.toHaveProperty(
    'averagePartyLevel',
  );
});

test('[rules.P83.ownership] reactive notes and persistent ending remain bound to their occurrence', async () => {
  const edit = vi.fn();
  render(
    <EventView
      view={{
        ...view,
        occurrences: [
          {
            ...view.occurrences[0]!,
            occurrence: {
              ...view.occurrences[0]!.occurrence,
              persistent: true,
            },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Add persistent decision' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'End' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Outcome' }), {
    target: { value: 'The event ended at the table.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sabotage' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add acknowledgements' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Add acknowledgements entry' }),
  );
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Outcome' })[1]!, {
    target: { value: 'Saboteurs disrupted the invaders.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save occurrence' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const event = edit.mock.lastCall?.[0].occurrence;
  expect(event.persistentDecision).toMatchObject({
    kind: 'end',
    eventId: 'root',
    acknowledgement: {
      subjectId: 'root',
      outcome: 'The event ended at the table.',
    },
  });
  expect(event.sabotage.acknowledgements[0].subjectId).toBe(
    `sabotage:root:${event.sabotage.choiceId}`,
  );
});

test('[rules.P83.candidates] Event edits preserve complete Activity candidate ownership and selection', () => {
  const edit = vi.fn();
  const candidate = view.occurrences[0]!.occurrence;
  const owner = {
    slotId: 'slot',
    choice: {
      choiceId: 'choice',
      actionId: 'guarantee_event' as const,
      teamId: 'team',
      candidates: [candidate],
    },
  };
  render(
    <EventView
      view={{ ...view, occurrences: [{ ...view.occurrences[0]!, owner }] }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Event 1 table roll' }),
    { target: { value: '50' } },
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'event_occurrence',
    occurrence: {
      ...candidate,
      tableRoll: {
        dice: [50],
        sides: 100,
        provenance: { kind: 'table' },
        modifiers: [],
      },
    },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Select this Activity event' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'detail',
    slotId: 'slot',
    choiceId: 'choice',
    choice: { ...owner.choice, selectedEventId: 'root' },
  });
});
