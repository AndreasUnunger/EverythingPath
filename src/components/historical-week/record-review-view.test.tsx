import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import {
  confirmedWeek,
  legacyRecord,
} from '../../../tests/history/resolution-record-fixtures';
import { WeekReviewSections } from '~/components/week-review/week-review';
import { recordWeekReview } from './record-review';
afterEach(cleanup);

const region = (name: string) => screen.getByRole('region', { name });

test('[rules.HIST-05.frozen-view] a frozen record renders the six historical sections read-only, quoting its recorded words', () => {
  const { container } = render(
    <WeekReviewSections facts={recordWeekReview(confirmedWeek().record)} />,
  );
  expect(
    screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual([
    '1Upkeep',
    '2Activity',
    '3Event',
    '4Persistent',
    '5Table Adjustments',
    '6Result · week 3 began',
  ]);
  // Only the local Show all toggle; no edit, clear, reorder or Confirm.
  expect(
    screen.getAllByRole('button').map((button) => button.textContent),
  ).toEqual(['Show all values']);
  expect(container.querySelector('input, textarea, select')).toBeNull();
  const activity = within(region('2 Activity'));
  expect(
    activity.getByText(
      'The disabled rescuers can undertake this limited rescue mission.',
    ),
  ).toBeVisible();
  expect(activity.getByText('The officer returns home')).toBeVisible();
  expect(
    within(region('Table Adjustments')).getByText('The officer was rescued'),
  ).toBeVisible();
  const table = within(screen.getByRole('table'));
  expect(
    table.getAllByRole('columnheader').map((node) => node.textContent),
  ).toEqual(['Value', 'At confirmation', 'Rules Baseline', 'Final']);
});

test('[rules.HIST-05.frozen-view-legacy] an older record says what it did not record and keeps its unlinked facts', () => {
  render(<WeekReviewSections facts={recordWeekReview(legacyRecord())} />);
  const result = within(region('Result'));
  expect(
    result.getByText('Some values were not included in this record.'),
  ).toBeVisible();
  expect(
    result.queryByText(/until every required decision is made/),
  ).toBeNull();
  expect(result.getAllByText('Not recorded').length).toBeGreaterThan(0);
  expect(result.queryByText('Not available')).toBeNull();
  fireEvent.click(result.getByRole('button', { name: 'Show all values' }));
  expect(result.getAllByText('Reconstructed from the table log').length).toBe(
    2,
  );
  // A recorded exception whose subject the record does not hold.
  const activity = within(region('2 Activity'));
  expect(
    activity.getByText('Its subject is not part of this recorded week.'),
  ).toBeVisible();
  expect(activity.queryByText('No longer part of this week.')).toBeNull();
  expect(activity.getByText('An extra day was allowed then')).toBeVisible();
  expect(activity.queryByText(/cannot permit an extra action/)).toBeNull();
  const unlinked = within(region('Unlinked facts'));
  expect(
    unlinked.getAllByText('The team allowance was exceeded.'),
  ).toHaveLength(2);
  expect(
    unlinked.getByText('Table outcome: A ruling from an earlier tool'),
  ).toBeVisible();
});
