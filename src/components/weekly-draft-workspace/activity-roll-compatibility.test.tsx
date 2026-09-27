import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { WeeklyDraftEdit } from '~/lib/weekly-draft-contract';
import type { RawRoll } from '~/lib/weekly-draft-facts';
import { ActivityView } from './activity-view';
import type { ActivityView as Facts } from './types';
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
const legacyCheck: RawRoll = {
  dice: [10],
  sides: 20,
  provenance: { kind: 'table' },
  modifiers: [],
};
function facts(rolls: Record<string, RawRoll>, requirements: string[]): Facts {
  return {
    phase: 'activity',
    ready: false,
    occupiedSlots: 1,
    slots: [
      {
        slotId: 'one',
        choice: {
          actionId: 'drill_militia',
          choiceId: 'drill',
          costCopper: 0,
          rolls,
        },
        overAllowance: false,
        strategistBonus: false,
        calculatedCostCopper: null,
        requirements,
        warnings: [],
        exceptions: [],
      },
    ],
    actions: [],
    items: [],
    caches: [],
    events: [],
    bonuses: [],
    startDay: 21,
    automaticSources: [],
    modifierSources: [
      { value: 'helpful', label: 'Helpful settlement support' },
    ],
    teams: [],
    settlements: [],
    people: [],
    operatingSettlementId: null,
    checks: [],
    requirements: [],
    warnings: [],
  };
}
function open() {
  screen
    .getByText('Edit Drill Militia details')
    .parentElement!.setAttribute('open', '');
}

test('[rules.ACT-12.total] a 2d6 training total is shown as the recorded total with no blank required dice, and clears through the existing rolls edit', () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <ActivityView
      view={facts({ check: legacyCheck, training: total(6, 2, 9) }, [])}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  const group = screen.getByRole('group', { name: 'Training roll' });
  expect(within(group).getByText('9')).toBeVisible();
  expect(within(group).getByText('2d6')).toBeVisible();
  expect(screen.getByText(/Training · 2d6/)).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: /Training die/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Check die 1' })).toHaveValue(
    '10',
  );
  fireEvent.click(
    within(group).getByRole('button', { name: 'Clear training roll' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'detail',
    slotId: 'one',
    choiceId: 'drill',
    choice: {
      actionId: 'drill_militia',
      choiceId: 'drill',
      costCopper: 0,
      rolls: { check: legacyCheck },
    },
  });
});

test('[rules.ACT-12.modifiers] adding a custom modifier to a total roll preserves its numeric representation exactly', async () => {
  const edit = vi.fn<(edit: WeeklyDraftEdit) => void>();
  render(
    <ActivityView
      view={facts({ check: total(20, 1, 0) }, [])}
      edit={edit}
      disabled={false}
    />,
  );
  open();
  const group = screen.getByRole('group', { name: 'Check roll' });
  expect(within(group).getByText('0')).toBeVisible();
  fireEvent.click(screen.getByText('Check sources and modifiers'));
  fireEvent.click(screen.getByRole('button', { name: 'Add modifiers entry' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Custom table modifier' }),
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Favourable weather' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save modifiers' }));
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const choice = edit.mock.lastCall![0];
  if (choice.kind !== 'detail') throw new Error('Expected detail edit');
  expect(choice.choice.rolls?.check).toEqual({
    ...total(20, 1, 0),
    modifiers: [
      {
        sourceId: expect.stringMatching(/^custom:/),
        value: 2,
        reason: 'Favourable weather',
      },
    ],
  });
  expect(choice.choice.rolls?.check).not.toHaveProperty('dice');
});

test('[rules.ACT-12.wrong-count] a total recorded for another specification is shown with what the step needs and remains required', () => {
  render(
    <ActivityView
      view={facts({ check: legacyCheck, training: total(6, 1, 4) }, [
        'drill:training:2d6',
      ])}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  open();
  const group = screen.getByRole('group', { name: 'Training roll' });
  expect(within(group).getByText('4')).toBeVisible();
  expect(within(group).getByText('1d6')).toBeVisible();
  expect(
    within(group).getByText(/needs 2d6, but the recorded total is for 1d6/),
  ).toBeVisible();
  expect(screen.getByText(/Training · 2d6/)).toBeVisible();
});

test('[rules.ACT-12.partial] a partial legacy training array keeps its die and its second required field', () => {
  render(
    <ActivityView
      view={facts(
        {
          check: legacyCheck,
          training: { ...legacyCheck, dice: [5], sides: 6 },
        },
        ['drill:training:2d6'],
      )}
      edit={vi.fn()}
      disabled={false}
    />,
  );
  open();
  expect(screen.getByRole('textbox', { name: 'Training die 1' })).toHaveValue(
    '5',
  );
  expect(screen.getByRole('textbox', { name: 'Training die 2' })).toHaveValue(
    '',
  );
  expect(screen.queryByText('Recorded total')).not.toBeInTheDocument();
});
