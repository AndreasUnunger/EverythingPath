import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CanonicalHistoryScreen, HistoricalWeekNavigation } from './screen';
import type { ComponentProps } from 'react';
import { canonicalResolutionRecordSchema } from '~/lib/canonical-resolution-record';
import { createWeeklyDraft } from '~/lib/weekly-draft';
const watchQuery = vi.fn();
const convex = { watchQuery: (...args: unknown[]) => watchQuery(...args) };
vi.mock('convex/react', () => ({
  useConvex: () => convex,
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
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
  createdAt: 2000,
  audit: [
    {
      recordId: 'latest',
      sequence: 1,
      provenance: 'historical_correction',
      createdAt: 3000,
    },
    {
      recordId: 'original',
      sequence: 0,
      provenance: 'confirmation',
      createdAt: 2000,
    },
  ],
  earlierSequence: 3,
};
test('[rules.P86.controls] history navigation selects whole records independently and shows correction information to all members', () => {
  const select = vi.fn();
  render(<HistoricalWeekNavigation history={history} select={select} />);
  expect(
    screen.getByRole('heading', { name: 'History correction' }),
  ).toBeInTheDocument();
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
  expect(
    screen.queryByRole('button', { name: /restore|reopen|confirm week/i }),
  ).not.toBeInTheDocument();
});

test('[shell.history] the route owns the selection, keeps the existing query arguments and retries locally', () => {
  let attempt = 0;
  watchQuery.mockImplementation(() => ({
    onUpdate: () => () => undefined,
    localQueryResult: () => {
      attempt += 1;
      if (attempt === 1) throw new Error('offline');
      return history;
    },
  }));
  const select = vi.fn();
  const view = render(
    <CanonicalHistoryScreen
      campaign="campaign"
      selection={{ week: 4, recordId: 'original', beforeSequence: 3 }}
      select={select}
    />,
  );
  expect(watchQuery).toHaveBeenLastCalledWith(expect.anything(), {
    campaignId: 'campaign',
    week: 4,
    recordId: 'original',
    beforeSequence: 3,
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Finished weeks could not be loaded.',
  );
  expect(screen.queryByText('Reload history')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Return to current week' }),
  ).toHaveAttribute('href', '/campaigns/campaign/week');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(watchQuery).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
  expect(select).toHaveBeenLastCalledWith({ week: 8 });
  view.rerender(
    <CanonicalHistoryScreen
      campaign="campaign"
      selection={{}}
      select={select}
    />,
  );
  expect(watchQuery).toHaveBeenLastCalledWith(expect.anything(), {
    campaignId: 'campaign',
    week: undefined,
    recordId: undefined,
    beforeSequence: undefined,
  });
});
