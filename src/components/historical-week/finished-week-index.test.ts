import { describe, expect, test } from 'vitest';
import {
  buildWeekIndex,
  earlierEntryLabel,
  headlineText,
  isWeekCovered,
  recordDate,
  rowHeadlines,
  rowMarker,
  type FinishedWeek,
  type ListWindow,
} from './finished-week-index';

function row(week: number, overrides: Partial<FinishedWeek> = {}) {
  return {
    week,
    effectiveRecordId: `record-${week}`,
    effectiveSequence: 0,
    entryCount: 1,
    provenance: 'confirmation',
    rulesetVersion: 1,
    createdAt: 1_700_000_000_000 + week,
    headlineFacts: [],
    ...overrides,
  } satisfies FinishedWeek;
}

// The listing returns rows latest-first; `earlierWeek` is the oldest returned
// week when an older one exists.
function window(
  beforeWeek: number | null,
  weeks: number[],
  hasEarlier: boolean,
): ListWindow {
  return {
    beforeWeek,
    listing: {
      weeks: weeks.map((week) => row(week)),
      earlierWeek: hasEarlier ? (weeks[weeks.length - 1] ?? null) : null,
      selected: null,
    },
  };
}

const items = (index: ReturnType<typeof buildWeekIndex>) =>
  index.map((item) =>
    item.kind === 'week' ? item.row.week : `earlier<${item.beforeWeek}`,
  );

describe('buildWeekIndex', () => {
  test('lists a complete history oldest first with no load-more control', () => {
    expect(
      items(buildWeekIndex([window(null, [9, 4, 2], false)], null)),
    ).toEqual([2, 4, 9]);
  });

  test('marks the omitted older range above the loaded window', () => {
    expect(
      items(buildWeekIndex([window(null, [40, 39, 38], true)], null)),
    ).toEqual(['earlier<38', 38, 39, 40]);
  });

  test('prepends an older window without duplicates and removes the filled gap', () => {
    const index = buildWeekIndex(
      [window(null, [40, 39, 38], true), window(38, [37, 30], false)],
      null,
    );
    expect(items(index)).toEqual([30, 37, 38, 39, 40]);
  });

  test('keeps a deep window apart from the newest one with a control for the gap between them', () => {
    const index = buildWeekIndex(
      [window(null, [60, 59], true), window(13, [12, 11], true)],
      null,
    );
    expect(items(index)).toEqual(['earlier<11', 11, 12, 'earlier<59', 59, 60]);
  });

  test('pins a selected week outside every loaded window without inventing its neighbours', () => {
    const index = buildWeekIndex([window(null, [60, 59], true)], row(12));
    expect(items(index)).toEqual([12, 'earlier<59', 59, 60]);
  });

  test('merges repeated rows by week, keeping the newest effective entry', () => {
    const newest = window(null, [5, 4], false);
    const older: ListWindow = {
      beforeWeek: 6,
      listing: {
        weeks: [row(5, { effectiveSequence: 2, entryCount: 3 }), row(4)],
        earlierWeek: null,
        selected: null,
      },
    };
    const index = buildWeekIndex([newest, older], row(5));
    expect(items(index)).toEqual([4, 5]);
    const five = index.find(
      (item) => item.kind === 'week' && item.row.week === 5,
    );
    expect(five).toMatchObject({
      row: { effectiveSequence: 2, entryCount: 3 },
    });
  });

  test('an empty listing yields no rows and no control', () => {
    expect(buildWeekIndex([window(null, [], false)], null)).toEqual([]);
  });
});

describe('isWeekCovered', () => {
  test('a window covers every week from its oldest row up to its boundary', () => {
    const windows = [window(null, [60, 59], true), window(13, [12, 11], true)];
    expect(isWeekCovered(windows, 59)).toBe(true);
    expect(isWeekCovered(windows, 100)).toBe(true);
    expect(isWeekCovered(windows, 12)).toBe(true);
    expect(isWeekCovered(windows, 13)).toBe(false);
    expect(isWeekCovered(windows, 30)).toBe(false);
    expect(isWeekCovered(windows, 3)).toBe(false);
  });

  test('a window that reached the oldest week covers down to zero', () => {
    expect(isWeekCovered([window(null, [4, 2], false)], 0)).toBe(true);
  });
});

describe('headlines', () => {
  const fact = {
    key: 'treasury',
    label: 'Treasury',
    before: 44_000,
    final: 58_507,
    beforeRecorded: true,
    finalRecorded: true,
    unit: 'gp' as const,
  };

  test('treasury changes are signed and copper-exact in gp', () => {
    expect(headlineText(fact)).toBe('Treasury +145.07 gp');
    expect(headlineText({ ...fact, before: 600, final: 545 })).toBe(
      'Treasury −0.55 gp',
    );
  });

  test('numeric changes are signed deltas', () => {
    expect(
      headlineText({
        ...fact,
        key: 'training',
        label: 'Training',
        unit: 'number',
        before: 12,
        final: 9,
      }),
    ).toBe('Training −3');
  });

  test('an unrecorded starting value shows only the recorded outcome, never a delta from zero', () => {
    expect(headlineText({ ...fact, before: null, beforeRecorded: false })).toBe(
      'Treasury now 585.07 gp',
    );
    expect(
      headlineText({
        ...fact,
        key: 'rank',
        label: 'Rank',
        unit: 'number',
        before: null,
        final: 8,
        beforeRecorded: false,
      }),
    ).toBe('Rank now 8');
  });

  test('subjects are added, removed or changed by their record-local label', () => {
    const team = {
      ...fact,
      key: 'team:t1',
      label: 'Scouts',
      unit: 'text' as const,
    };
    expect(headlineText({ ...team, before: null, final: 'active' })).toBe(
      'Scouts added',
    );
    expect(headlineText({ ...team, before: 'active', final: null })).toBe(
      'Scouts removed',
    );
    expect(headlineText({ ...team, before: 'active', final: 'disabled' })).toBe(
      'Scouts Active → Disabled',
    );
  });

  test('a militia text value without a starting value reads as none, not added', () => {
    expect(
      headlineText({
        ...fact,
        key: 'focus',
        label: 'Focus',
        unit: 'text',
        before: null,
        final: 'arcane',
      }),
    ).toBe('Focus None → Arcane');
  });

  test('a fact without a recorded outcome is not shown', () => {
    expect(
      headlineText({ ...fact, finalRecorded: false, final: null }),
    ).toBeNull();
  });

  test('rows show at most two headlines, or say a recorded outcome is available', () => {
    expect(rowHeadlines(row(3))).toEqual(['Recorded outcome available']);
    expect(
      rowHeadlines(
        row(3, {
          headlineFacts: [
            fact,
            {
              ...fact,
              key: 'training',
              label: 'Training',
              unit: 'number',
              before: 1,
              final: 2,
            },
          ],
        }),
      ),
    ).toEqual(['Treasury +145.07 gp', 'Training +1']);
  });
});

describe('row marker and dates', () => {
  test('corrected weeks show their entry count; reconstructed weeks say so', () => {
    expect(rowMarker(row(3))).toBeNull();
    expect(
      rowMarker(row(3, { entryCount: 3, provenance: 'historical_correction' })),
    ).toBe('Corrected · 3 entries');
    expect(rowMarker(row(3, { provenance: 'historical_reconstruction' }))).toBe(
      'Reconstructed',
    );
  });

  test('record dates carry a machine-readable instant and a readable date', () => {
    const date = recordDate(Date.UTC(2026, 2, 5, 12));
    expect(date.dateTime).toBe('2026-03-05T12:00:00.000Z');
    expect(date.label).toMatch(/2026/);
  });

  test('earlier entries show their ordinal only when it is known', () => {
    expect(earlierEntryLabel(0, 3)).toBe('Earlier entry 1 of 3');
    expect(earlierEntryLabel(null, 3)).toBe('Earlier entry');
    expect(earlierEntryLabel(4, null)).toBe('Earlier entry');
  });
});
