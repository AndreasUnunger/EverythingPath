import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { SummaryView } from './summary-view';
import type { PhaseView } from './types';
afterEach(cleanup);
const view: Extract<PhaseView, { phase: 'summary' }> = {
  phase: 'summary',
  effects: null,
  ready: true,
  baseline: null,
  outcome: null,
  requirements: [],
  warnings: [],
  adjustments: [],
  exceptions: [],
  acknowledgements: [],
  people: [],
  options: {},
};
const controls = {
  disabled: false,
  canConfirm: true,
  forecastPending: false,
  reviewRequired: false,
  confirm: vi.fn(),
  review: vi.fn(),
};
test('[rules.P85.adjustment] signed copper adjustment requires a reason and stages the complete ordered list', async () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  render(<SummaryView view={view} edit={edit} {...controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Militia value' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
    target: { value: '-125' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() =>
    expect(screen.getByText('A value is required.')).toBeInTheDocument(),
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Copper correction' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() =>
    expect(edit).toHaveBeenCalledWith({
      kind: 'table_adjustments',
      adjustments: [
        {
          kind: 'militia_value',
          adjustmentId: expect.any(String),
          field: 'treasuryCopper',
          operation: 'add',
          value: -125,
          reason: 'Copper correction',
        },
      ],
    }),
  );
});
test('[rules.P85.review] a rejected review requires an explicit fresh review and cannot confirm pending forecasts', () => {
  render(
    <SummaryView
      view={view}
      edit={vi.fn()}
      {...controls}
      canConfirm={false}
      reviewRequired
      forecastPending
    />,
  );
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Review updated week' }),
  ).toBeDisabled();
});

test('[rules.P85.order] moving and clearing adjudication retains complete other adjustments', async () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  const adjustments: typeof view.adjustments = [
    {
      adjustmentId: 'first',
      kind: 'militia_value',
      field: 'treasuryCopper',
      operation: 'add',
      value: 125,
      reason: 'Reward',
    },
    {
      adjustmentId: 'second',
      kind: 'militia_value',
      field: 'treasuryCopper',
      operation: 'set',
      value: 1000,
      reason: 'Correction',
    },
  ];
  render(
    <SummaryView view={{ ...view, adjustments }} edit={edit} {...controls} />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Move adjustment 2 earlier' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'table_adjustments',
      adjustments: [adjustments[1], adjustments[0]],
    }),
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Clear adjustment' })[0]!,
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'table_adjustments',
      adjustments: [adjustments[1]],
    }),
  );
});

test('[rules.P85.exception] reasoned shared exception preserves its subject and can be explicitly cleared', async () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  render(
    <SummaryView
      view={{
        ...view,
        exceptions: [
          {
            exceptionId: 'exception',
            subjectId: 'choice',
            ruleId: 'team-capacity',
            name: 'Recruitment',
            reason: '',
          },
        ],
      }}
      edit={edit}
      {...controls}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Exception Reason' }), {
    target: { value: 'Narrative reinforcements' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save exception reason' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'rules_exception',
      exception: {
        exceptionId: 'exception',
        subjectId: 'choice',
        ruleId: 'team-capacity',
        reason: 'Narrative reinforcements',
      },
    }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Clear exception reason' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'exception',
  });
});
