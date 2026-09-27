import { expect, test } from 'vitest';
import { rawRollSchema } from './weekly-draft-facts';
import { normalizeRawRoll } from './raw-roll';

const metadata = {
  provenance: { kind: 'generated', sourceId: 'session-roll' },
  modifiers: [{ sourceId: 'custom:weather', value: -2, reason: 'Heavy rain' }],
};

test('legacy dice and dice-only totals round-trip without rewriting provenance or modifiers', () => {
  const legacy = { ...metadata, sides: 4, dice: [2, 4] };
  const total = { ...metadata, sides: 4, diceCount: 2, diceTotal: 6 };
  expect(rawRollSchema.parse(legacy)).toEqual(legacy);
  expect(rawRollSchema.parse(total)).toEqual(total);
});

test('complete 2d4 normalizes to the same dice-only result in either representation', () => {
  const expected = { count: 2, sides: 4 };
  const result = {
    ...expected,
    status: 'complete',
    diceTotal: 6,
    naturalValue: null,
    rangeWarning: null,
  };
  expect(
    normalizeRawRoll(
      rawRollSchema.parse({ ...metadata, sides: 4, dice: [2, 4] }),
      expected,
    ),
  ).toEqual(result);
  expect(
    normalizeRawRoll(
      rawRollSchema.parse({
        ...metadata,
        sides: 4,
        diceCount: 2,
        diceTotal: 6,
      }),
      expected,
    ),
  ).toEqual(result);
});

test.each([
  { dice: [3], sides: 4 },
  { dice: [1, 2, 3], sides: 4 },
  { dice: [2, 4], sides: 6 },
  { diceTotal: 6, diceCount: 1, sides: 4 },
  { diceTotal: 6, diceCount: 2, sides: 6 },
])(
  'a recorded roll with the wrong 2d4 specification remains incomplete: %j',
  (recorded) => {
    expect(
      normalizeRawRoll(rawRollSchema.parse({ ...metadata, ...recorded }), {
        count: 2,
        sides: 4,
      }),
    ).toEqual({
      count: 2,
      sides: 4,
      status: 'incomplete',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    });
  },
);

test.each([undefined, null])('an absent roll remains missing (%s)', (raw) => {
  expect(normalizeRawRoll(raw, { count: 1, sides: 20 })).toEqual({
    count: 1,
    sides: 20,
    status: 'missing',
    diceTotal: null,
    naturalValue: null,
    rangeWarning: null,
  });
});

test.each([1, 20])(
  'single-die natural %s excludes custom modifiers in both forms',
  (value) => {
    for (const recorded of [
      { dice: [value] },
      { diceTotal: value, diceCount: 1 },
    ]) {
      const raw = rawRollSchema.parse({ ...metadata, sides: 20, ...recorded });
      expect(normalizeRawRoll(raw, { count: 1, sides: 20 })).toMatchObject({
        status: 'complete',
        diceTotal: value,
        naturalValue: value,
        rangeWarning: null,
      });
      expect(raw.modifiers).toEqual(metadata.modifiers);
    }
  },
);

test('a multidie total of twenty is never a natural twenty', () => {
  expect(
    normalizeRawRoll(
      rawRollSchema.parse({
        ...metadata,
        sides: 20,
        diceCount: 2,
        diceTotal: 20,
      }),
      { count: 2, sides: 20 },
    ),
  ).toMatchObject({
    status: 'complete',
    diceTotal: 20,
    naturalValue: null,
  });
});

test.each([
  { recorded: { dice: [0, 4] }, total: 4, warning: 'legacy-die' },
  { recorded: { dice: [1, 5] }, total: 6, warning: 'legacy-die' },
  { recorded: { dice: [2, 4] }, total: 6, warning: null },
  { recorded: { diceTotal: 0, diceCount: 2 }, total: 0, warning: 'total' },
  { recorded: { diceTotal: 1, diceCount: 2 }, total: 1, warning: 'total' },
  { recorded: { diceTotal: 9, diceCount: 2 }, total: 9, warning: 'total' },
  { recorded: { diceTotal: 2, diceCount: 2 }, total: 2, warning: null },
  { recorded: { diceTotal: 8, diceCount: 2 }, total: 8, warning: null },
])(
  '2d4 range diagnostics remain advisory and retain recorded evidence: %j',
  ({ recorded, total, warning }) => {
    expect(
      normalizeRawRoll(
        rawRollSchema.parse({ ...metadata, sides: 4, ...recorded }),
        { count: 2, sides: 4 },
      ),
    ).toMatchObject({
      status: 'complete',
      diceTotal: total,
      naturalValue: null,
      rangeWarning: warning,
    });
  },
);

test.each([
  { dice: [1], diceTotal: 1, diceCount: 1 },
  { dice: [1], diceCount: 1 },
  { diceTotal: 1 },
  { diceCount: 1 },
  { dice: [] },
  { dice: [1], extra: true },
  { diceTotal: 1, diceCount: 1, extra: true },
])('roll alternatives remain strict and unambiguous: %j', (fields) => {
  expect(
    rawRollSchema.safeParse({ ...metadata, sides: 20, ...fields }).success,
  ).toBe(false);
});

test.each(['diceTotal', 'diceCount'] as const)(
  '%s accepts only safe finite whole numbers with its required sign',
  (field) => {
    const total = { ...metadata, sides: 4, diceTotal: 6, diceCount: 2 };
    for (const invalid of [
      -1,
      0.5,
      Infinity,
      -Infinity,
      NaN,
      Number.MAX_SAFE_INTEGER + 1,
      '6',
      null,
    ]) {
      expect(
        rawRollSchema.safeParse({ ...total, [field]: invalid }).success,
      ).toBe(false);
    }
    expect(
      rawRollSchema.safeParse({ ...total, [field]: Number.MAX_SAFE_INTEGER })
        .success,
    ).toBe(true);
    expect(rawRollSchema.safeParse({ ...total, [field]: 0 }).success).toBe(
      field === 'diceTotal',
    );
  },
);

test.each([
  { sides: 1 },
  { sides: 4.5 },
  { provenance: { kind: 'generated' } },
  { provenance: { kind: 'table', sourceId: 'unexpected' } },
  { modifiers: [{ sourceId: 'custom', value: 1.5, reason: 'Weather' }] },
  { modifiers: [{ sourceId: 'custom', value: 1, reason: '' }] },
  {
    modifiers: [
      { sourceId: 'custom', value: 1, reason: 'Weather', extra: true },
    ],
  },
])('both forms retain common structural constraints: %j', (invalid) => {
  for (const fields of [{ dice: [2] }, { diceTotal: 2, diceCount: 1 }]) {
    expect(
      rawRollSchema.safeParse({ ...metadata, sides: 4, ...fields, ...invalid })
        .success,
    ).toBe(false);
  }
});

test('normalization never rewrites partial dice, provenance, modifiers or total records', () => {
  for (const fields of [{ dice: [2] }, { diceTotal: 6, diceCount: 2 }]) {
    const raw = rawRollSchema.parse({ ...metadata, sides: 4, ...fields });
    const before = structuredClone(raw);
    Object.freeze(raw.provenance);
    raw.modifiers.forEach(Object.freeze);
    Object.freeze(raw.modifiers);
    if ('dice' in raw) Object.freeze(raw.dice);
    Object.freeze(raw);
    normalizeRawRoll(raw, { count: 2, sides: 4 });
    expect(raw).toEqual(before);
  }
});
