import { workspaceSourceSchema } from '~/lib/weekly-workspace-source';
import { foundationWeek } from '../../../tests/rules/foundation-acceptance-fixtures';
import { projectWeeklyDraft } from '~/lib/canonical-weekly-resolution';
import { activityView as activityFacts } from './activity-facts';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi, type Mock } from 'vitest';
afterEach(cleanup);
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
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
      strategistBonus: false,
      calculatedCostCopper: null,
      requirements: [],
      warnings: [],
      exceptions: [],
    },
    {
      slotId: 'two',
      choice: null,
      overAllowance: false,
      strategistBonus: false,
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
  automaticSources: [],
  modifierSources: [{ value: 'helpful', label: 'Helpful settlement support' }],
  teams: [],
  settlements: [],
  people: [],
  operatingSettlementId: null,
  checks: [],
  requirements: [],
  warnings: [],
};
test('[rules.P82.cards] accessible placement moves whole choices and deck placement replaces occupied choices', () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
      edit={vi.fn<(edit: WeeklyDraftEdit) => void>()}
      disabled={false}
    />,
  );
  expect(screen.getByText(/The roll is outside its usual range/)).toBeVisible();
  expect(
    screen.getByText(/The preview uses the calculated cost/),
  ).toBeVisible();
  expect(screen.queryByText('drill:check:roll-range')).not.toBeInTheDocument();
});

test('[rules.P82.receipt] recording an order receipt binds its notes to the same receipt and order', async () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: {
              choiceId: 'order-choice',
              actionId: 'special_order',
              orderId: 'order',
            },
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

test('[rules.P82.modifiers] players type a signed custom check modifier with a reason', async () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <ActivityView
      view={{
        ...view,
        slots: [
          {
            ...view.slots[0]!,
            choice: {
              choiceId: 'drill',
              actionId: 'drill_militia',
              rolls: {
                check: {
                  dice: [10],
                  sides: 20,
                  provenance: { kind: 'table' },
                  modifiers: [],
                },
              },
            },
          },
        ],
      }}
      edit={edit}
      disabled={false}
    />,
  );
  screen
    .getByText('Edit Drill Militia details')
    .parentElement!.setAttribute('open', '');
  screen
    .getByText('Check sources and modifiers')
    .parentElement!.setAttribute('open', '');
  fireEvent.click(screen.getByRole('button', { name: 'Add modifiers entry' }));
  const amount = screen.getByRole('textbox', { name: 'Value' });
  fireEvent.change(amount, { target: { value: '-' } });
  expect(amount).toHaveValue('-');
  fireEvent.change(amount, { target: { value: '-2' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Heavy rain' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save modifiers' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith(
      expect.objectContaining({
        choice: expect.objectContaining({
          rolls: {
            check: {
              dice: [10],
              sides: 20,
              provenance: { kind: 'table' },
              modifiers: [
                {
                  sourceId: expect.stringMatching(/^custom:/),
                  value: -2,
                  reason: 'Heavy rain',
                },
              ],
            },
          },
        }),
      }),
    ),
  );
});

test('[rules.P82.sources] automatic candidates select a named queued source', async () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <ActivityView
      view={{
        ...view,
        automaticSources: [
          { value: 'queue-source', label: 'Queued celebration' },
        ],
        slots: [
          {
            ...view.slots[0]!,
            choice: {
              choiceId: 'guarantee',
              actionId: 'guarantee_event',
              candidates: [
                {
                  eventId: 'candidate',
                  origin: { kind: 'automatic', sourceId: 'old-source' },
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
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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

function detailChoice(edit: Mock<(edit: WeeklyDraftEdit) => void>) {
  const operation = edit.mock.calls[0]![0];
  if (operation.kind !== 'detail') throw new Error('Expected detail edit');
  return operation.choice;
}

test('[rules.P82.provenance] recorded roll provenance stays intact without offering incomplete source selection', async () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
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
                  tableRoll: {
                    dice: [50],
                    sides: 100,
                    provenance: { kind: 'generated', sourceId: 'recorded-die' },
                    modifiers: [],
                  },
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

test('[rules.F04.capacity-guidance] retained extra-slot choices explain correction without suggesting an exception', () => {
  const extra = structuredClone(view);
  extra.slots[0]!.overAllowance = true;
  extra.slots[0]!.warnings = ['drill:action-capacity'];
  render(<ActivityView view={extra} edit={vi.fn()} disabled={false} />);
  expect(
    screen.getByText(/restore the allowance before confirming the week/),
  ).toBeVisible();
  expect(
    screen.queryByText(/record an exception with a reason/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'Action Capacity exception' }),
  ).not.toBeInTheDocument();
});

test('[rules.O05.slot-label] the automatic Strategist label follows rank and ordered assignments on empty and occupied slots', () => {
  const input = foundationWeek(1);
  input.militiaSnapshot.roster.officers = [
    { role: 'strategist', characterId: 'pc' },
  ];
  input.revision.activity.slots.push({ slotId: 'third', choice: null });
  const facts = () =>
    activityFacts(
      input.revision,
      workspaceSourceSchema.parse({
        key: {
          campaignId: 'campaign',
          militiaId: 'militia',
          draftId: input.revision.draftId,
        },
        sourceRevision: 0,
        snapshot: input.militiaSnapshot,
        people: [{ characterId: 'pc', name: 'Officer' }],
      }),
      projectWeeklyDraft(input),
    );
  const edit = vi.fn();
  const { rerender } = render(
    <ActivityView view={facts()} edit={edit} disabled={false} />,
  );
  const slot = (index: number) => screen.getByLabelText(`Action Slot ${index}`);
  expect(within(slot(2)).getByText('Empty slot')).toBeInTheDocument();
  expect(within(slot(2)).getByText('Strategist +2')).toBeInTheDocument();
  expect(
    within(slot(2)).getByText(
      'Adds +2 to organization checks for the action in this slot.',
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Strategist +2')).toHaveLength(1);
  input.revision.activity.slots[1]!.choice = {
    choiceId: 'work',
    actionId: 'special',
    instruction: 'Scout',
    costCopper: 0,
  };
  rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
  expect(within(slot(2)).getByText('Strategist +2')).toBeInTheDocument();
  input.militiaSnapshot.rank = 2;
  input.militiaSnapshot.training = 11;
  rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
  expect(within(slot(2)).queryByText('Strategist +2')).not.toBeInTheDocument();
  expect(within(slot(3)).getByText('Strategist +2')).toBeInTheDocument();
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    fromRole: 'strategist',
  };
  rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
  expect(screen.queryByText('Strategist +2')).not.toBeInTheDocument();
  input.militiaSnapshot.roster.officers = [];
  input.revision.activity.slots[0]!.choice = {
    choiceId: 'role',
    actionId: 'change_officer_role',
    characterId: 'pc',
    toRole: 'strategist',
  };
  rerender(<ActivityView view={facts()} edit={edit} disabled={false} />);
  expect(within(slot(3)).getByText('Strategist +2')).toBeInTheDocument();
  expect(edit).not.toHaveBeenCalled();
});
