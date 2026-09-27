import { expect, test } from 'vitest';
import type { FinishedWeekHeadlineFact } from '~/lib/finished-week-headlines';
import {
  headlineText,
  recentWeeks,
  recordedOutcomeAvailable,
  type FinishedWeekList,
} from './recent-weeks';

type Row = FinishedWeekList['weeks'][number];
const row = (week: number, patch: Partial<Row> = {}): Row => ({
  week,
  effectiveRecordId: `record-${week}`,
  effectiveSequence: 0,
  entryCount: 1,
  provenance: 'confirmation',
  rulesetVersion: 6,
  createdAt: 0,
  headlineFacts: [],
  ...patch,
});
const list = (weeks: Row[]): FinishedWeekList => ({
  weeks,
  earlierWeek: null,
  selected: null,
});
const fact = (
  patch: Partial<FinishedWeekHeadlineFact>,
): FinishedWeekHeadlineFact => ({
  key: 'treasury',
  label: 'Treasury',
  before: 44000,
  final: 58500,
  beforeRecorded: true,
  finalRecorded: true,
  unit: 'gp',
  ...patch,
});

test('zero, one and two finished weeks are valid previews', () => {
  expect(recentWeeks('c', list([]))).toEqual([]);
  expect(recentWeeks('c', list([row(3)])).map((item) => item.week)).toEqual([
    3,
  ]);
  expect(
    recentWeeks('c', list([row(9), row(4)])).map((item) => item.week),
  ).toEqual([9, 4]);
});

test('sparse weeks keep their listed latest-first order and link to their own week', () => {
  const weeks = recentWeeks('campaign', list([row(13), row(12), row(7)]));
  expect(weeks.map(({ week, href }) => [week, href])).toEqual([
    [13, '/campaigns/campaign/history?week=13'],
    [12, '/campaigns/campaign/history?week=12'],
    [7, '/campaigns/campaign/history?week=7'],
  ]);
});

test('Corrected takes precedence over From setup, which marks only an uncorrected reconstruction', () => {
  const badges = recentWeeks(
    'c',
    list([
      row(5, { entryCount: 3, provenance: 'historical_correction' }),
      row(4, { entryCount: 2, provenance: 'historical_reconstruction' }),
      row(3, { provenance: 'historical_reconstruction' }),
    ]),
  ).map((item) => item.badge);
  expect(badges).toEqual(['Corrected', 'Corrected', 'From setup']);
  expect(recentWeeks('c', list([row(2)]))[0]!.badge).toBeNull();
});

test('a week without comparable facts reads Recorded outcome available', () => {
  expect(recentWeeks('c', list([row(2)]))[0]!.headlines).toEqual([
    recordedOutcomeAvailable,
  ]);
});

test('headlines show signed gp and number changes from recorded pairs', () => {
  expect(headlineText(fact({}))).toBe('Treasury +145 gp');
  expect(headlineText(fact({ before: 58500, final: 44000 }))).toBe(
    'Treasury −145 gp',
  );
  expect(
    headlineText(
      fact({
        key: 'training',
        label: 'Training',
        unit: 'number',
        before: 30,
        final: 27,
      }),
    ),
  ).toBe('Training −3');
  expect(
    headlineText(
      fact({ key: 'rank', label: 'Rank', unit: 'number', before: 3, final: 4 }),
    ),
  ).toBe('Rank +1');
});

test('an unknown starting value shows only the recorded result, never a change from zero', () => {
  expect(
    headlineText(fact({ before: null, beforeRecorded: false, final: 58500 })),
  ).toBe('Treasury 585 gp');
  expect(
    headlineText(
      fact({
        key: 'focus',
        label: 'Focus',
        unit: 'text',
        before: null,
        beforeRecorded: false,
        final: 'Loyalty',
      }),
    ),
  ).toBe('Focus: Loyalty');
});

test('text headlines show changes and added or removed subjects with record-local names', () => {
  const text = { unit: 'text' as const };
  expect(
    headlineText(
      fact({
        ...text,
        key: 'focus',
        label: 'Focus',
        before: null,
        final: 'Security',
      }),
    ),
  ).toBe('Focus: Not set → Security');
  expect(
    headlineText(
      fact({
        ...text,
        key: 'team:t1',
        label: 'Hawks',
        before: 'active',
        final: 'disabled',
      }),
    ),
  ).toBe('Hawks: Active → Disabled');
  expect(
    headlineText(
      fact({
        ...text,
        key: 'team:t2',
        label: 'Team 2',
        before: null,
        final: 'active',
      }),
    ),
  ).toBe('Team 2 added: Active');
  expect(
    headlineText(
      fact({
        ...text,
        key: 'settlement:s',
        label: 'Phaendar',
        before: 'Friendly',
        final: null,
      }),
    ),
  ).toBe('Phaendar removed');
  expect(
    headlineText(
      fact({
        ...text,
        key: 'event:e',
        label: 'Persistent event 1',
        before: null,
        final: 'sickness',
      }),
    ),
  ).toBe('Persistent event 1 added: Sickness');
});

test('only recorded outcomes become headlines, at most three weeks are shown', () => {
  const weeks = recentWeeks(
    'c',
    list([
      row(4, {
        headlineFacts: [fact({ finalRecorded: false }), fact({ key: 'x' })],
      }),
      row(3),
      row(2),
      row(1),
    ]),
  );
  expect(weeks).toHaveLength(3);
  expect(weeks[0]!.headlines).toEqual(['Treasury +145 gp']);
});
