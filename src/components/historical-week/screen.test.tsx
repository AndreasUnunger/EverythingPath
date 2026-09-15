import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { HistoricalWeekNavigation } from './screen';
import type { ComponentProps } from 'react';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import { createWeeklyDraft } from '~/lib/weekly-draft';
afterEach(cleanup);
const source = createWeeklyDraft({
  draftId: 'closed',
  week: 4,
  slotIds: [],
  context: {
    firstMilitiaWeek: false,
    startDay: 21,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  },
});
const record = canonicalResolutionRecordSchema.parse({
  recordId: 'original',
  source,
  provenance: 'confirmation',
  rulesetVersion: 1,
  baselinePlan: { formatVersion: 1, data: {} },
  finalPlan: { formatVersion: 1, data: {} },
  finalOutcome: { formatVersion: 1, data: {} },
  adjudication: {
    acknowledgements: [],
    rulesExceptions: [],
    tableAdjustments: [],
  },
  warnings: [],
  successorContext: {
    firstMilitiaWeek: false,
    startDay: 28,
    uneventfulCarry: false,
    carriedEvents: [],
    queuedEffects: [],
    orders: [],
    lastBuyoffWeek: null,
  },
  supersedesRecordId: null,
});
const history: ComponentProps<typeof HistoricalWeekNavigation>['history'] = {
  week: 4,
  record,
  effectiveRecordId: 'latest',
  previousWeek: 2,
  nextWeek: 8,
  audit: [
    { recordId: 'latest', sequence: 1, provenance: 'historical_correction' },
    { recordId: 'original', sequence: 0, provenance: 'confirmation' },
  ],
  earlierSequence: 3,
  canRewriteHistory: false,
};
test('[rules.P86.controls] history navigation selects whole records independently and exposes the correction seam only to GMs', () => {
  const select = vi.fn();
  const { rerender } = render(
    <HistoricalWeekNavigation history={history} select={select} />,
  );
  expect(
    screen.queryByRole('heading', { name: 'GM history correction' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
  expect(select).toHaveBeenLastCalledWith({ week: 2 });
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
  expect(select).toHaveBeenLastCalledWith({ week: 8 });
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmed week · Entry 1' }),
  );
  expect(select).toHaveBeenLastCalledWith({ week: 4, recordId: 'original' });
  fireEvent.click(
    screen.getByRole('button', { name: 'Show effective record' }),
  );
  expect(select).toHaveBeenLastCalledWith({ week: 4 });
  fireEvent.click(screen.getByRole('button', { name: 'Earlier entries' }));
  expect(select).toHaveBeenLastCalledWith({
    week: 4,
    recordId: 'original',
    beforeSequence: 3,
  });
  rerender(
    <HistoricalWeekNavigation
      history={{ ...history, canRewriteHistory: true }}
      select={select}
    />,
  );
  expect(
    screen.getByRole('heading', { name: 'GM history correction' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /restore|reopen|confirm week/i }),
  ).not.toBeInTheDocument();
});
