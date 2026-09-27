import { activityWarning } from './activity-warnings';
import {
  acceptingEdit,
  activityFacts,
  activitySlot,
  selectSlot,
} from './activity-view-fixture';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
afterEach(cleanup);
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
const view: Facts = activityFacts(
  [
    activitySlot({
      actionId: 'drill_militia',
      choiceId: 'drill',
      costCopper: 0,
    }),
    activitySlot(null, { slotId: 'two', number: 2 }),
  ],
  { actions: [{ actionId: 'lie_low', name: 'Lie Low' }] },
);
test('[rules.P82.nested] a purchase keeps copper precision, requires its price and stages a complete typed detail', async () => {
  const edit = acceptingEdit();
  const purchaseView: Facts = {
    ...view,
    slots: [activitySlot({ choiceId: 'market', actionId: 'broker_market' })],
  };
  render(<ActivityView view={purchaseView} edit={edit} disabled={false} />);
  selectSlot('Broker Market');
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
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({ choiceId: 'rescue', actionId: 'rescue_character' }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Rescue Character');
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
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [activitySlot({ choiceId: 'order', actionId: 'special_order' })],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Special Order');
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
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        items: [{ value: 'internal-item', label: 'Healing potion' }],
        slots: [activitySlot({ choiceId: 'cache', actionId: 'secure_cache' })],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Secure Cache');
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
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'guarantee',
            actionId: 'guarantee_event',
            candidates: [{ eventId: 'candidate', origin: { kind: 'rolled' } }],
            selectedEventId: 'candidate',
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Guarantee Event');
  fireEvent.click(screen.getByRole('button', { name: 'Clear candidates' }));
  await waitFor(() =>
    expect(
      screen.getByText('Candidates: Unknown selected event candidate'),
    ).toHaveAttribute('role', 'alert'),
  );
  expect(edit).not.toHaveBeenCalled();
});

test('[rules.P82.candidate-owner] a persistent candidate decision belongs to the event being edited', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'guarantee',
            actionId: 'guarantee_event',
            candidates: [
              {
                eventId: 'candidate',
                origin: { kind: 'rolled' },
                persistent: true,
              },
            ],
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Guarantee Event');
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

test('[rules.P82.warnings] staged choices explain range and calculated-cost mismatches in their details and count them on the card', () => {
  const warnings = ['drill:check:roll-range', 'drill:calculated-cost'];
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot(view.slots[0]!.choice, {
            warnings,
            warningCount: 2,
            issues: warnings.map((code) => ({
              code,
              message: activityWarning(code, 'drill'),
            })),
          }),
        ],
      }}
      edit={acceptingEdit()}
      disabled={false}
    />,
  );
  expect(
    within(screen.getByRole('group', { name: 'Action Slot 1' })).getByText(
      '2 warnings',
    ),
  ).toBeVisible();
  selectSlot('Drill Militia');
  expect(screen.getByText(/The roll is outside its usual range/)).toBeVisible();
  expect(
    screen.getByText(/The preview uses the calculated cost/),
  ).toBeVisible();
  expect(screen.queryByText('drill:check:roll-range')).not.toBeInTheDocument();
});
test('[rules.P82.receipt] recording an order receipt binds its notes to the same receipt and order', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'order-choice',
            actionId: 'special_order',
            orderId: 'order',
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Special Order');
  fireEvent.change(screen.getByRole('textbox', { name: 'Receipt notes' }), {
    target: { value: 'The ordered potion arrived' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record receipt' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = detailChoice(edit);
  if (choice.actionId !== 'special_order') throw new Error('Expected order');
  expect(choice.receipt).toEqual({
    receivedDay: 21,
    acknowledgementId: expect.any(String),
  });
  expect(choice.acknowledgements).toEqual([
    {
      acknowledgementId: choice.receipt!.acknowledgementId,
      subjectId: 'order',
      outcome: 'The ordered potion arrived',
    },
  ]);
});

test('[rules.P82.sources] automatic candidates select a named queued source', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        automaticSources: [
          { value: 'queue-source', label: 'Queued celebration' },
        ],
        slots: [
          activitySlot({
            choiceId: 'guarantee',
            actionId: 'guarantee_event',
            candidates: [
              {
                eventId: 'candidate',
                origin: { kind: 'automatic', sourceId: 'old-source' },
              },
            ],
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Guarantee Event');
  fireEvent.click(screen.getByRole('button', { name: 'Queued celebration' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({
          candidates: [
            expect.objectContaining({
              origin: { kind: 'automatic', sourceId: 'queue-source' },
            }),
          ],
        }),
      }),
    ),
  );
  expect(screen.queryByDisplayValue('old-source')).not.toBeInTheDocument();
});

test('[rules.P82.nested-acknowledgements] event ending and sabotage notes bind to their owning candidate', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'guarantee',
            actionId: 'guarantee_event',
            candidates: [
              {
                eventId: 'candidate',
                origin: { kind: 'rolled' },
                persistent: true,
              },
            ],
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Guarantee Event');
  fireEvent.click(
    screen.getByRole('button', { name: 'Add persistent decision' }),
  );
  fireEvent.click(screen.getByRole('button', { name: /^End$/ }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Outcome' }), {
    target: { value: 'The event was resolved at the table' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add sabotage' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add acknowledgements' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Add acknowledgements entry' }),
  );
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Outcome' })[1]!, {
    target: { value: 'Saboteurs disrupted the event' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = detailChoice(edit);
  if (choice.actionId !== 'guarantee_event')
    throw new Error('Expected event choice');
  const candidate = choice.candidates![0]!;
  if (candidate.persistentDecision?.kind !== 'end' || !candidate.sabotage)
    throw new Error('Expected both decisions');
  expect(candidate.persistentDecision.acknowledgement.subjectId).toBe(
    'candidate',
  );
  expect(candidate.sabotage.choiceId).toEqual(expect.any(String));
  expect(candidate.sabotage.acknowledgements![0]!.subjectId).toBe(
    `sabotage:candidate:${candidate.sabotage.choiceId}`,
  );
});

function detailChoice(edit: ReturnType<typeof acceptingEdit>) {
  const operation = edit.mock.calls[0]![0];
  if (operation.kind !== 'detail') throw new Error('Expected detail edit');
  return operation.choice;
}

test('[rules.P82.provenance] recorded roll provenance stays intact without offering incomplete source selection', async () => {
  const edit = acceptingEdit();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          activitySlot({
            choiceId: 'guarantee',
            actionId: 'guarantee_event',
            candidates: [
              {
                eventId: 'candidate',
                origin: { kind: 'rolled' },
                tableRoll: {
                  dice: [50],
                  sides: 100,
                  provenance: { kind: 'generated', sourceId: 'recorded-die' },
                  modifiers: [],
                },
              },
            ],
          }),
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  selectSlot('Guarantee Event');
  expect(
    screen.queryByRole('button', { name: 'Generated' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('recorded-die')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save candidates' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({
          candidates: [
            expect.objectContaining({
              tableRoll: expect.objectContaining({
                provenance: { kind: 'generated', sourceId: 'recorded-die' },
              }),
            }),
          ],
        }),
      }),
    ),
  );
});
