import { expect, expectTypeOf, test } from 'vitest';
import {
  resolveSheet,
  type LeafTarget,
  type ResolvedStatistic,
} from './character-sheet';
import { parseCharacterSheetBreakdowns } from './character-sheet-breakdowns';

test('wire breakdowns parse into a complete map of typed leaf targets', () => {
  const breakdowns = resolveSheet(
    [
      {
        target: 'ability.str',
        bonusType: 'enhancement',
        value: 2,
        sheetEntryId: 'belt',
        entryName: 'Belt of giant strength',
        source: 'belt-rule',
        builtIn: false,
      },
      {
        target: 'ability.str',
        bonusType: 'enhancement',
        value: 4,
        sheetEntryId: 'strength-spell',
        entryName: 'Strength spell',
        source: 'strength-spell-rule',
        builtIn: false,
        condition: { whileActive: 'strength-spell-rule' },
        stacksWithinEntry: true,
        stacksWithItself: true,
      },
      {
        target: 'ability.str',
        bonusType: 'circumstance',
        value: 2,
        sheetEntryId: 'training',
        entryName: 'Special training',
        source: 'training-rule',
        builtIn: true,
        condition: { situation: { local: 'lifting' } },
      },
    ],
    { activeCatalogEntryIds: ['strength-spell-rule'] },
  );
  const parsed = parseCharacterSheetBreakdowns(breakdowns);
  expect(parsed).toEqual(breakdowns);
  expect(parsed['ability.str'].applied[0]?.sheetEntryId).toBe('strength-spell');
  expect(parsed['ability.str'].suppressed[0]).toMatchObject({
    sheetEntryId: 'belt',
    suppressedBy: 'strength-spell',
    reason: expect.any(String),
  });
  expect(parsed['ability.str'].conditional[0]?.sheetEntryId).toBe('training');
  expectTypeOf(parsed).toEqualTypeOf<Record<LeafTarget, ResolvedStatistic>>();
});

test('wire breakdowns refuse unknown targets', () => {
  expect(() =>
    parseCharacterSheetBreakdowns({
      ...resolveSheet([]),
      'ability.invalid': {
        total: 0,
        applied: [],
        suppressed: [],
        conditional: [],
      },
    }),
  ).toThrow();
});

test('wire breakdowns refuse missing targets instead of inventing totals', () => {
  const { hp: _hp, ...missing } = resolveSheet([]);
  expect(() => parseCharacterSheetBreakdowns(missing)).toThrow();
});

test('wire breakdowns refuse malformed statistic values', () => {
  expect(() =>
    parseCharacterSheetBreakdowns({
      ...resolveSheet([]),
      hp: { total: 'unknown', applied: [], suppressed: [], conditional: [] },
    }),
  ).toThrow();
});
