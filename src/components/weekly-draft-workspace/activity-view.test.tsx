import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
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
      requirements: [],
      warnings: [],
      exceptions: [],
    },
    {
      slotId: 'two',
      choice: null,
      overAllowance: false,
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
