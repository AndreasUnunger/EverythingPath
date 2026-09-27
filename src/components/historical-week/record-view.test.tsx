import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { weeklyDraftDataSchema } from '~/lib/weekly-draft-contract';
import { createWeeklyDraft } from '~/lib/weekly-draft';
import type { CanonicalResolutionRecord } from '~/lib/canonical-resolution-record';
import { HistoricalRecordView } from './record-view';
afterEach(cleanup);
const source = weeklyDraftDataSchema.parse(
  createWeeklyDraft({
    draftId: 'private-draft-id',
    week: 11,
    slotIds: ['private-slot'],
    context: {
      firstMilitiaWeek: false,
      startDay: 70,
      uneventfulCarry: true,
      carriedEvents: [],
      queuedEffects: [],
      orders: [],
      lastBuyoffWeek: null,
    },
  }),
);
source.tableAdjustments = [
  {
    adjustmentId: 'private-adjustment',
    kind: 'militia_value',
    field: 'treasuryCopper',
    operation: 'add',
    value: 7,
    reason: 'Recovered copper',
  },
];
source.rulesExceptions = [
  {
    exceptionId: 'private-exception',
    ruleId: 'team-capacity',
    subjectId: 'private-slot',
    reason: 'Allies joined for this week',
  },
];
source.acknowledgements = [
  {
    acknowledgementId: 'private-ack',
    subjectId: 'private-slot',
    outcome: 'The road is clear',
  },
];
const record: CanonicalResolutionRecord = {
  recordId: 'private-record',
  source,
  rulesetVersion: 3,
  provenance: 'confirmation',
  baselinePlan: { formatVersion: 1, data: { treasuryCopper: 80 } },
  finalPlan: { formatVersion: 1, data: { treasuryCopper: 87 } },
  finalOutcome: { formatVersion: 1, data: { treasuryCopper: 87 } },
  warnings: [
    { code: 'team-capacity', message: 'The team allowance was exceeded.' },
  ],
  adjudication: {
    tableAdjustments: source.tableAdjustments,
    rulesExceptions: source.rulesExceptions,
    acknowledgements: source.acknowledgements,
  },
  successorContext: { ...source.context, startDay: 77 },
  supersedesRecordId: null,
};
test('[rules.P86.display] historical display uses recorded plans, context and table decisions with no editable controls', () => {
  const { container, rerender } = render(
    <HistoricalRecordView record={record} />,
  );
  expect(
    within(
      screen.getByRole('region', { name: 'Rules baseline plan' }),
    ).getByText('80'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Final outcome' })).getByText(
      '87',
    ),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Recovered copper').length).toBeGreaterThan(0);
  expect(
    screen.getAllByText('Allies joined for this week').length,
  ).toBeGreaterThan(0);
  expect(screen.getAllByText('The road is clear').length).toBeGreaterThan(0);
  expect(
    screen.getByText('The team allowance was exceeded.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Militia facts were not included in this record.'),
  ).toBeInTheDocument();
  expect(container.textContent).not.toContain('private-');
  expect(container.textContent).not.toContain('treasuryCopper');
  expect(container.querySelector('input, textarea, select, button')).toBeNull();
  rerender(
    <HistoricalRecordView
      record={{
        ...record,
        recordId: 'correction',
        provenance: 'historical_correction',
        supersedesRecordId: record.recordId,
        finalOutcome: { formatVersion: 1, data: { training: 12 } },
      }}
    />,
  );
  expect(
    within(screen.getByRole('region', { name: 'Final outcome' })).queryByText(
      '87',
    ),
  ).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Final outcome' })).getByText(
      '12',
    ),
  ).toBeInTheDocument();
});

test('[rules.P86.labels] historical references remain distinguishable without exposing IDs or renaming rules and table notes', () => {
  const annotated: CanonicalResolutionRecord = {
    ...record,
    source: {
      ...record.source,
      activity: {
        ...record.source.activity,
        consumableIds: ['opaque-bonus-first', 'opaque-bonus-second'],
        slots: [
          {
            slotId: 'private-slot',
            choice: { choiceId: 'a', actionId: 'earn_gold' },
          },
        ],
      },
    },
    finalOutcome: {
      formatVersion: 1,
      data: {
        note: 'a',
        actionId: 'earn_gold',
        operatedSettlementIds: ['opaque-settlement'],
      },
    },
    warnings: [
      { code: 'recorded-warning', message: 'This is a recorded warning.' },
    ],
  };
  const { container } = render(<HistoricalRecordView record={annotated} />);
  expect(container.textContent).not.toContain('opaque-');
  expect(container.textContent).not.toContain('private-');
  expect(container.textContent).not.toContain('treasuryCopper');
  expect(screen.getAllByText('Earn Gold').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Team capacity').length).toBeGreaterThan(0);
  expect(screen.getByText('Consumable 1')).toBeInTheDocument();
  expect(screen.getByText('Consumable 2')).toBeInTheDocument();
  expect(screen.getByText('This is a recorded warning.')).toBeInTheDocument();
  expect(
    within(screen.getByRole('region', { name: 'Final outcome' })).getByText(
      'a',
    ),
  ).toBeInTheDocument();
});
