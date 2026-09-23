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
  expect(
    screen.getByRole('button', { name: 'Treasury (copper)' }),
  ).toBeInTheDocument();
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

test('[rules.P85.outcomes] full preview includes named event bonuses and future effects without exposing event identities', () => {
  const state = {
    week: 5,
    militiaSnapshot: {
      rank: 2,
      training: 14,
      treasuryCopper: 5000,
      notoriety: 0,
      focus: 'Loyalty' as const,
      roster: { people: [], teams: [], officers: [] },
      characters: [],
      settlements: [],
      bonuses: [
        {
          bonusId: 'hidden-bonus',
          source: 'hidden-event',
          check: 'loyalty' as const,
          value: 2,
          availableWeek: 5,
          consumedWeek: null,
        },
      ],
    },
    context: {
      firstMilitiaWeek: false,
      startDay: 28,
      uneventfulCarry: true,
      carriedEvents: [],
      queuedEffects: [
        {
          effectId: 'hidden-effect',
          sourceId: 'hidden-event',
          startsWeek: 5,
          endsWeek: 6,
          effect: {
            kind: 'narrative' as const,
            instruction: 'Neighbors_supply_scouts',
          },
        },
      ],
      orders: [],
      lastBuyoffWeek: null,
    },
  };
  render(
    <SummaryView
      view={{
        ...view,
        baseline: state,
        outcome: state,
        options: {
          eventId: [{ value: 'hidden-event', label: 'High Morale · Event 1' }],
          sourceId: [{ value: 'hidden-event', label: 'High Morale · Event 1' }],
        },
      }}
      edit={vi.fn()}
      {...controls}
    />,
  );
  expect(screen.queryByText('hidden-event')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-bonus')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-effect')).not.toBeInTheDocument();
  expect(
    screen.getAllByText('High Morale · Event 1').length,
  ).toBeGreaterThanOrEqual(2);
  expect(screen.getAllByText('Neighbors_supply_scouts')).toHaveLength(2);
});

test('[rules.P85.readiness] readiness names the required decisions and warnings never expose opaque targets', () => {
  render(
    <SummaryView
      view={{
        ...view,
        ready: false,
        requirements: [
          'upkeep:attrition-training:roll',
          'choice-secret:team-type',
          'team:team-secret:recovery-decision',
          'choice-secret:treasury:exception',
        ],
        warnings: ['choice-secret:opaque-secret'],
        options: {
          subjectId: [
            { value: 'choice-secret', label: 'Recruit Team · Slot 1' },
            { value: 'team-secret', label: 'Scouts' },
          ],
        },
      }}
      edit={vi.fn()}
      {...controls}
      canConfirm={false}
    />,
  );
  expect(
    screen.getByText('Upkeep: Enter the attrition training roll.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Recruit Team · Slot 1: Choose the type of team to recruit.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Scouts: Choose whether to recover, leave or remove this disabled team.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Recruit Team · Slot 1: Review this rules departure in the affected phase with the table.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Recruit Team · Slot 1: The calculated cost exceeds the available treasury. Record a reasoned Rules Exception or revise the choice.',
    ),
  ).toBeInTheDocument();
  expect(document.body.textContent).not.toContain('secret');
});

test('[rules.F04.obsolete-exception] an old capacity exception remains visible for removal but cannot be edited into permission', () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  render(
    <SummaryView
      view={{
        ...view,
        ready: false,
        requirements: ['quiet:action-capacity'],
        options: { subjectId: [{ value: 'quiet', label: 'Lie Low' }] },
        exceptions: [
          {
            exceptionId: 'old',
            subjectId: 'quiet',
            ruleId: 'action-capacity',
            name: 'Lie Low',
            reason: 'An extra day was once allowed',
          },
        ],
      }}
      edit={edit}
      {...controls}
      canConfirm={false}
    />,
  );
  expect(screen.getByText('An extra day was once allowed')).toBeVisible();
  expect(
    screen.getByText(/restore the action allowance before confirming/),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeDisabled();
  expect(
    screen.queryByRole('textbox', { name: 'Exception Reason' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove obsolete exception' }),
  );
  expect(edit).toHaveBeenCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'old',
  });
});
