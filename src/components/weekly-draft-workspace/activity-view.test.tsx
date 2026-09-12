import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
afterEach(cleanup);
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
const view: Facts = {
  phase: 'activity',
  ready: false,
  occupiedSlots: 1,
  slots: [
    {
      slotId: 'one',
      choice: { actionId: 'drill_militia', choiceId: 'drill', costCopper: 0 },
      overAllowance: false,
      calculatedCostCopper: null,
      requirements: [],
      warnings: [],
      exceptions: [],
    },
    {
      slotId: 'two',
      choice: null,
      overAllowance: false,
      calculatedCostCopper: null,
      requirements: [],
      warnings: [],
      exceptions: [],
    },
  ],
  actions: [{ actionId: 'lie_low', name: 'Lie Low' }],
  items: [],
  caches: [],
  events: [],
  bonuses: [],
  startDay: 21,
  teams: [],
  settlements: [],
  people: [],
  operatingSettlementId: null,
  checks: [],
  requirements: [],
  warnings: [],
};
test('[rules.P82.cards] accessible placement moves whole choices and deck placement replaces occupied choices', () => {
  const edit = vi.fn();
  render(<ActivityView view={view} edit={edit} disabled={false} />);
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Move Drill Militia from Action Slot 1',
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Place in Action Slot 2' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'move',
    fromSlotId: 'one',
    toSlotId: 'two',
    choiceId: 'drill',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Choose Lie Low' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Replace Action Slot 1' }),
  );
  expect(edit).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'replace',
      slotId: 'one',
      choiceId: 'drill',
      choice: expect.objectContaining({ actionId: 'lie_low' }),
    }),
  );
});

test('[rules.P82.nested] a purchase keeps copper precision, requires its price and stages a complete typed detail', async () => {
  const edit = vi.fn();
  const purchaseView: Facts = {
    ...view,
    slots: [
      {
        ...view.slots[0]!,
        choice: { choiceId: 'market', actionId: 'broker_market' },
      },
    ],
  };
  render(<ActivityView view={purchaseView} edit={edit} disabled={false} />);
  fireEvent.click(screen.getByText('Edit Broker Market details'));
  // jsdom does not toggle the native details element on click.
  screen
    .getByText('Edit Broker Market details')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Add purchases' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add purchases entry' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save purchases' }));
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => alert.textContent === 'A value is required.'),
    ).toBe(true),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Price (copper)' }), {
    target: { value: '123' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Price (copper)' }), {
    target: { value: '1e3' },
  });
  expect(screen.getByRole('textbox', { name: 'Price (copper)' })).toHaveValue(
    '123',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save purchases' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'detail',
        choice: expect.objectContaining({
          purchases: [{ itemId: expect.any(String), priceCopper: 123 }],
        }),
      }),
    ),
  );
});

test('[rules.P82.union] optional destination can be added and saved without inventing a character reference', async () => {
  const edit = vi.fn();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: { choiceId: 'rescue', actionId: 'rescue_character' },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Rescue Character details')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Add destination' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save destination' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'detail',
        choice: expect.objectContaining({
          destination: { kind: 'headquarters' },
        }),
      }),
    ),
  );
});

test('[rules.P82.decimal] item weight can be typed as a decimal and complete detail failures are visible', async () => {
  const edit = vi.fn();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: { choiceId: 'order', actionId: 'special_order' },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Special Order details')
    .parentElement!.setAttribute('open', '');
  const weight = screen.getByRole('textbox', { name: 'Weight' });
  fireEvent.change(weight, { target: { value: '1' } });
  fireEvent.change(weight, { target: { value: '1.' } });
  expect(weight).toHaveValue('1.');
  fireEvent.change(weight, { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save weight' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({ weight: 1.5 }),
      }),
    ),
  );
});

test('[rules.P82.references] cache item lists use named cards instead of internal references', async () => {
  const edit = vi.fn();
  render(
    <ActivityView
      view={{
        ...view,
        items: [{ value: 'internal-item', label: 'Healing potion' }],
        slots: [
          {
            ...view.slots[0]!,
            choice: { choiceId: 'cache', actionId: 'secure_cache' },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Secure Cache details')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Add item' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add item entry' }));
  fireEvent.click(screen.getByRole('button', { name: 'Healing potion' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({ itemIds: ['internal-item'] }),
      }),
    ),
  );
  expect(screen.queryByDisplayValue('internal-item')).not.toBeInTheDocument();
});

test('[rules.P82.validation] removing a selected event candidate explains the structural failure', async () => {
  const edit = vi.fn();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: {
              choiceId: 'guarantee',
              actionId: 'guarantee_event',
              candidates: [
                { eventId: 'candidate', origin: { kind: 'rolled' } },
              ],
              selectedEventId: 'candidate',
            },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Guarantee Event details')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Clear candidates' }));
  await waitFor(() =>
    expect(
      screen.getByText('Candidates: Unknown selected event candidate'),
    ).toHaveAttribute('role', 'alert'),
  );
  expect(edit).not.toHaveBeenCalled();
});

test('[rules.P82.candidate-owner] a persistent candidate decision belongs to the event being edited', async () => {
  const edit = vi.fn();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: {
              choiceId: 'guarantee',
              actionId: 'guarantee_event',
              candidates: [
                {
                  eventId: 'candidate',
                  origin: { kind: 'rolled' },
                  persistent: true,
                },
              ],
            },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Guarantee Event details')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(
    screen.getByRole('button', { name: 'Add persistent decision' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({
          candidates: [
            expect.objectContaining({
              eventId: 'candidate',
              persistentDecision: { kind: 'unattempted', eventId: 'candidate' },
            }),
          ],
        }),
      }),
    ),
  );
});

test('[rules.P82.warnings] staged cards explain range and calculated-cost mismatches', () => {
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            warnings: ['drill:check:roll-range', 'drill:calculated-cost'],
          },
        ],
      }}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  expect(screen.getByText(/A die is outside its usual range/)).toBeVisible();
  expect(
    screen.getByText(/The preview uses the calculated cost/),
  ).toBeVisible();
  expect(screen.queryByText('drill:check:roll-range')).not.toBeInTheDocument();
});
