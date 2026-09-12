import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { PersistentView } from './persistent-view';
import type { PersistentView as Facts } from './types';
afterEach(cleanup);
const event: Facts['events'][number] = {
  eventId: 'rivalry',
  eventType: 'rivalry',
  startedWeek: 1,
  order: 0,
  targets: [
    { kind: 'team', teamId: 'one' },
    { kind: 'team', teamId: 'two' },
  ],
  name: 'Rivalry · Event 1',
  ageWeeks: 3,
  targetNames: ['Scouts', 'Rangers'],
  decision: null,
  ended: false,
  changes: [],
  checks: [],
  exceptions: [],
  requirements: [],
  warnings: [],
};
const view: Facts = {
  phase: 'persistent',
  ready: true,
  firstBuyoff: true,
  nextBuyoffWeek: 4,
  buyoffCostCopper: 4000,
  options: { characterId: [{ value: 'pc', label: 'Aubrin' }] },
  events: [event],
  requirements: [],
  warnings: [],
};
test('[rules.P84.decisions] per-instance choices preserve identity and prefill projected buyoff', () => {
  const edit = vi.fn();
  render(<PersistentView view={view} edit={edit} disabled={false} />);
  expect(screen.getByText('Targets: Scouts, Rangers')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Buy off event' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'rivalry', costCopper: 4000 },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Attempt officer ending' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'mitigate', eventId: 'rivalry' },
  });
  expect(
    screen.queryByRole('button', { name: 'Attempt temporary mitigation' }),
  ).toBeNull();
});
test('[rules.P84.ending] ending notes bind to the carried event and stay editable after projected ending', async () => {
  const edit = vi.fn();
  render(
    <PersistentView
      view={{ ...view, events: [{ ...event, ended: true }] }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Ending outcome' }), {
    target: { value: 'The officers reconciled the teams' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save ending outcome' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'persistent_decision',
      decision: {
        kind: 'end',
        eventId: 'rivalry',
        acknowledgement: {
          acknowledgementId: expect.any(String),
          subjectId: 'rivalry',
          outcome: 'The officers reconciled the teams',
        },
      },
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear decision' }));
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_persistent_decision',
    eventId: 'rivalry',
  });
});
test('[rules.P84.officer] officer details accept named references, signed skill bonuses and owned rolls', async () => {
  const edit = vi.fn();
  render(
    <PersistentView
      view={{
        ...view,
        events: [
          { ...event, decision: { kind: 'mitigate', eventId: 'rivalry' } },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add officer check' }));
  fireEvent.click(screen.getByRole('button', { name: 'Aubrin' }));
  fireEvent.click(screen.getByRole('button', { name: 'Diplomacy' }));
  const bonus = screen.getByRole('textbox', { name: 'Skill Bonus' });
  fireEvent.change(bonus, { target: { value: '-' } });
  fireEvent.change(bonus, { target: { value: '-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add roll' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add dice entry' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Entry 1' }), {
    target: { value: '20' },
  });
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
          skillBonus: -2,
          roll: {
            dice: [20],
            sides: 20,
            provenance: { kind: 'table' },
            modifiers: [],
          },
        },
      },
    }),
  );
  expect(
    within(
      screen.getByRole('group', { name: 'Rivalry · Event 1' }),
    ).queryByRole('textbox', { name: 'Event' }),
  ).toBeNull();
});

test('[rules.P84.copper] buyoff cost preserves zero and clear and rejects malformed text without changing the rules cost', () => {
  const edit = vi.fn();
  render(
    <PersistentView
      view={{
        ...view,
        events: [
          {
            ...event,
            decision: { kind: 'buyoff', eventId: 'rivalry', costCopper: 4000 },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  const amount = screen.getByRole('textbox', {
    name: 'Recorded buyoff cost (copper)',
  });
  fireEvent.change(amount, { target: { value: '1e2' } });
  expect(amount).toHaveValue('4000');
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(amount, { target: { value: '0' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'rivalry', costCopper: 0 },
  });
  fireEvent.change(amount, { target: { value: '' } });
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'persistent_decision',
    decision: { kind: 'buyoff', eventId: 'rivalry' },
  });
  expect(screen.getByText('Projected buyoff cost: 4000 cp.')).toBeVisible();
});
