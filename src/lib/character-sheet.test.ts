import { expect, test } from 'vitest';
import { calculateCharacterSheet } from './character-sheet';

test('base Modifiers supply all scores and round odd negative modifiers down', () => {
  const result = calculateCharacterSheet({
    entries: [
      {
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        modifiers: [
          { target: 'ability.str', bonusType: 'base', value: 7 },
          { target: 'ability.dex', bonusType: 'base', value: 10 },
          { target: 'ability.con', bonusType: 'base', value: 14 },
          { target: 'ability.int', bonusType: 'base', value: 15 },
          { target: 'ability.wis', bonusType: 'base', value: 18 },
          { target: 'ability.cha', bonusType: 'base', value: 21 },
        ],
      },
    ],
  });
  expect(result).toEqual({
    abilities: {
      strength: { score: 7, modifier: -2 },
      dexterity: { score: 10, modifier: 0 },
      constitution: { score: 14, modifier: 2 },
      intelligence: { score: 15, modifier: 2 },
      wisdom: { score: 18, modifier: 4 },
      charisma: { score: 21, modifier: 5 },
    },
    level: 0,
    hitDice: 0,
    hp: 0,
  });
});

test.each([
  { hp: [8, 5], constitution: 14, total: 17 },
  { hp: [0, 1], constitution: 7, total: -3 },
  { hp: [8, null], constitution: 14, total: null },
  { hp: [0], constitution: 10, total: 0 },
])(
  'Class Levels derive level, Hit Dice and recorded HP: $hp / Con $constitution',
  ({ hp, constitution, total }) => {
    const result = calculateCharacterSheet({
      entries: [
        {
          kind: 'base',
          active: true,
          catalogEntryId: 'base',
          state: { kind: 'base' },
        },
        ...hp.map((hpGained, index) => ({
          kind: 'classLevel' as const,
          active: true as const,
          state: {
            kind: 'classLevel' as const,
            classEntryId: null,
            position: index + 1,
            hpGained,
          },
        })),
      ],
      catalogEntries: [
        {
          _id: 'base',
          modifiers: [
            { target: 'ability.str', bonusType: 'base', value: 10 },
            { target: 'ability.dex', bonusType: 'base', value: 10 },
            { target: 'ability.con', bonusType: 'base', value: constitution },
            { target: 'ability.int', bonusType: 'base', value: 10 },
            { target: 'ability.wis', bonusType: 'base', value: 10 },
            { target: 'ability.cha', bonusType: 'base', value: 10 },
          ],
        },
      ],
    });
    expect(result).toMatchObject({
      level: hp.length,
      hitDice: hp.length,
      hp: total,
    });
  },
);

test('missing or ambiguous base Catalog Entries remain unresolved instead of inventing scores', () => {
  const entries = [
    {
      kind: 'base' as const,
      active: true as const,
      catalogEntryId: 'base',
      state: { kind: 'base' as const },
    },
  ];
  expect(() =>
    calculateCharacterSheet({ entries: [], catalogEntries: [] }),
  ).toThrow('one base-scores entry');
  expect(() =>
    calculateCharacterSheet({
      entries: [...entries, ...entries],
      catalogEntries: [],
    }),
  ).toThrow('one base-scores entry');
  expect(() =>
    calculateCharacterSheet({ entries, catalogEntries: [] }),
  ).toThrow('Base scores are unavailable');
  const modifiers = [
    { target: 'ability.str' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.dex' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.con' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.int' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.wis' as const, bonusType: 'base' as const, value: 10 },
    { target: 'ability.cha' as const, bonusType: 'base' as const, value: 10 },
  ];
  for (const invalid of [
    modifiers.slice(1),
    modifiers.map((modifier) => ({
      ...modifier,
      target: 'ability.str' as const,
    })),
    modifiers.map((modifier) => ({ ...modifier, value: NaN })),
  ]) {
    expect(() =>
      calculateCharacterSheet({
        entries,
        catalogEntries: [{ _id: 'base', modifiers: invalid }],
      }),
    ).toThrow('six finite Modifiers');
  }
});
