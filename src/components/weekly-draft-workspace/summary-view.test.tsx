import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type {
  ResultRow,
  ReviewException,
  ReviewPhase,
  ReviewSection,
  WeekReviewFacts,
} from '~/components/week-review/review-facts';
import { SummaryView } from './summary-view';
import type { PhaseView } from './types';
afterEach(cleanup);
function section(
  phase: ReviewPhase,
  number: ReviewSection['number'],
  title: string,
): ReviewSection {
  return {
    phase,
    number,
    title,
    chips: [],
    status: 'empty',
    statusText: `No ${title} consequences this week.`,
    items: [],
  };
}
const review: WeekReviewFacts = {
  mode: 'live',
  sections: [
    section('upkeep', 1, 'Upkeep'),
    section('activity', 2, 'Activity'),
    section('event', 3, 'Event'),
    section('persistent', 4, 'Persistent'),
  ],
  unassociated: [],
  adjustments: [],
  result: { nextWeek: 5, complete: true, rows: [] },
};
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
  review,
};
/** The exception note the live adapter attaches to the item it belongs to. */
function withException(
  note: ReviewException,
  title: string,
  missing = false,
): WeekReviewFacts {
  const [upkeep, activity, event, persistent] = review.sections;
  return {
    ...review,
    sections: [
      upkeep,
      {
        ...activity,
        status: 'complete',
        statusText: null,
        items: [
          {
            key: note.subjectId,
            title,
            details: [],
            effects: [],
            notes: [note],
            missing,
          },
        ],
      },
      event,
      persistent,
    ],
  };
}
/** A Summary whose accepted list and review facts hold these adjustments. */
function withAdjustments(
  adjustments: typeof view.adjustments,
  extra: Partial<typeof view> = {},
): typeof view {
  return {
    ...view,
    ...extra,
    adjustments,
    review: {
      ...review,
      adjustments: adjustments.map((adjustment, index) => ({
        key: `adjustment:${adjustment.adjustmentId}`,
        adjustmentId: adjustment.adjustmentId,
        number: index + 1,
        kind: 'Militia value',
        effect: `Effect ${adjustment.adjustmentId}`,
        reason: adjustment.reason,
        notes: [],
      })),
    },
  };
}
const controls = {
  disabled: false,
  canConfirm: true,
  forecastPending: false,
  reviewRequired: false,
  confirm: vi.fn(),
  review: vi.fn(),
};
test('[rules.P85.adjustment] signed gp adjustment requires a reason and stages the complete ordered list', async () => {
  const edit = vi.fn().mockResolvedValue('accepted');
  render(<SummaryView view={view} edit={edit} {...controls} />);
  fireEvent.click(screen.getByRole('button', { name: 'Militia value' }));
  const form = within(
    screen.getByRole('form', { name: 'New Militia value adjustment' }),
  );
  // The new Militia value form defaults to Treasury / Add.
  expect(form.getByRole('button', { name: 'Treasury' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(form.getByRole('button', { name: 'Add' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.change(form.getByRole('textbox', { name: 'Amount' }), {
    target: { value: '-1.25' },
  });
  fireEvent.change(form.getByRole('textbox', { name: 'Reason' }), {
    target: { value: '   ' },
  });
  fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() =>
    expect(form.getByText('A reason is required.')).toBeInTheDocument(),
  );
  expect(form.getByRole('textbox', { name: 'Reason' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(edit).not.toHaveBeenCalled();
  fireEvent.change(form.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Copper correction' },
  });
  fireEvent.click(form.getByRole('button', { name: 'Save adjustment' }));
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
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'New Militia value adjustment' }),
    ).not.toBeInTheDocument(),
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

test('[rules.P85.order] moving and removing adjudication retains complete other adjustments', async () => {
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
    <SummaryView
      view={withAdjustments(adjustments)}
      edit={edit}
      {...controls}
    />,
  );
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(
    screen.getByRole('button', { name: 'Move adjustment 1 earlier' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Move adjustment 2 later' }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Move adjustment 2 earlier' }),
  );
  await waitFor(() =>
    expect(edit).toHaveBeenLastCalledWith({
      kind: 'table_adjustments',
      adjustments: [adjustments[1], adjustments[0]],
    }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove adjustment 1' }));
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
        review: withException(
          {
            kind: 'exception',
            key: 'exception:exception',
            exceptionId: 'exception',
            subjectId: 'choice',
            ruleId: 'team-capacity',
            rule: 'Team capacity',
            reason: '',
            obsolete: false,
          },
          'Recruitment',
        ),
      }}
      edit={edit}
      {...controls}
    />,
  );
  expect(screen.getByText('Recruitment')).toBeInTheDocument();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Reason for Team capacity exception' }),
    { target: { value: ' Narrative reinforcements ' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Save Team capacity reason' }),
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
    screen.getByRole('button', { name: 'Clear Team capacity exception' }),
  );
  expect(edit).toHaveBeenLastCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'exception',
  });
});

test('[rules.P85.outcomes] full preview includes named event bonuses and future effects without exposing event identities', () => {
  const rows: ResultRow[] = [
    {
      key: 'bonus:hidden-bonus',
      group: 'Bonuses',
      label: 'High Morale · Event 1',
      now: { kind: 'absent', text: 'Not recorded' },
      baseline: { kind: 'value', text: 'Loyalty +2', key: 'hidden-bonus' },
      final: { kind: 'value', text: 'Loyalty +2', key: 'hidden-bonus' },
      changed: true,
      finalDiffers: false,
      difference: null,
    },
    {
      key: 'effect:hidden-effect',
      group: 'Queued effects',
      label: 'High Morale · Event 1',
      now: {
        kind: 'value',
        text: 'Neighbors supply scouts',
        key: 'hidden-effect',
      },
      baseline: {
        kind: 'value',
        text: 'Neighbors supply scouts',
        key: 'hidden-effect',
      },
      final: {
        kind: 'value',
        text: 'Neighbors supply scouts',
        key: 'hidden-effect',
      },
      changed: false,
      finalDiffers: false,
      difference: null,
    },
  ];
  render(
    <SummaryView
      view={{
        ...view,
        review: { ...review, result: { ...review.result, rows } },
      }}
      edit={vi.fn()}
      {...controls}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Show all values' }));
  expect(screen.queryByText('hidden-event')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-bonus')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-effect')).not.toBeInTheDocument();
  expect(
    screen.getAllByText('High Morale · Event 1').length,
  ).toBeGreaterThanOrEqual(2);
  expect(
    screen.getAllByText('Neighbors supply scouts').length,
  ).toBeGreaterThanOrEqual(2);
  expect(document.body.textContent).not.toContain('hidden-');
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
      'Scouts: Choose whether to recover this disabled team or leave it disabled.',
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
        review: withException(
          {
            kind: 'exception',
            key: 'exception:old',
            exceptionId: 'old',
            subjectId: 'quiet',
            ruleId: 'action-capacity',
            rule: 'Action capacity',
            reason: 'An extra day was once allowed',
            obsolete: true,
          },
          'Lie Low',
          true,
        ),
      }}
      edit={edit}
      {...controls}
      canConfirm={false}
    />,
  );
  expect(screen.getByText('An extra day was once allowed')).toBeVisible();
  expect(screen.getByText('No longer part of this week.')).toBeVisible();
  expect(
    screen.getByText(/restore the action allowance before confirming/),
  ).toBeVisible();
  expect(
    screen.getByText(/This recorded exception cannot permit an extra action/),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Confirm week' })).toBeDisabled();
  expect(
    screen.queryByRole('textbox', { name: /Reason for/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Remove obsolete exception' }),
  );
  expect(edit).toHaveBeenCalledWith({
    kind: 'clear_rules_exception',
    exceptionId: 'old',
  });
});

test('[confirming] the existing Confirm control reads Confirming… while this device waits for the next week', () => {
  render(
    <SummaryView
      view={view}
      edit={vi.fn()}
      {...controls}
      disabled
      confirming
      canConfirm={false}
    />,
  );
  const button = screen.getByRole('button', { name: 'Confirming…' });
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(
    screen.queryByRole('button', { name: 'Confirm week' }),
  ).not.toBeInTheDocument();
});
