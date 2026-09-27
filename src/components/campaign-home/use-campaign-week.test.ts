import { expect, test } from 'vitest';
import { campaignWeek } from './use-campaign-week';

const key = { key: { campaignId: 'c', militiaId: 'm', draftId: 'd' } };

test('loading and failure are never "Not set up"', () => {
  expect(campaignWeek({}, {})).toEqual({ kind: 'loading' });
  expect(campaignWeek({ error: new Error('x') }, {})).toEqual({
    kind: 'failed',
  });
  expect(campaignWeek({ data: key }, {})).toEqual({ kind: 'loading' });
  expect(campaignWeek({ data: key }, { error: new Error('x') })).toEqual({
    kind: 'failed',
  });
});

test('no workspace is Not set up; an open draft gives its week', () => {
  expect(campaignWeek({ data: null }, {})).toEqual({ kind: 'not_set_up' });
  expect(
    campaignWeek({ data: key }, { data: { draft: { week: 14 } } }),
  ).toEqual({ kind: 'week', week: 14 });
  // A just-confirmed draft is closed until its successor is observed.
  expect(campaignWeek({ data: key }, { data: { draft: null } })).toEqual({
    kind: 'loading',
  });
});
