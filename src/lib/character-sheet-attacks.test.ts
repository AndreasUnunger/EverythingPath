import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetInput,
} from './character-sheet';
import { attackRoutineWeaponUses } from './character-sheet-attacks';

function attackSheet(bab = 11): CharacterSheetInput {
  return {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: {
          kind: 'base',
          proficiencies: { added: [{ category: 'martial' }], removed: [] },
        },
      },
      {
        _id: 'bab-row',
        kind: 'manual',
        active: true,
        catalogEntryId: 'bab',
        state: { kind: 'manual' },
      },
      {
        _id: 'weapon-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item' },
      },
      {
        _id: 'routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Sword',
          weaponEntryId: 'weapon-row',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: [
          ...abilityKeys.map((ability) => ({
            target: abilityTargets[ability],
            bonusType: 'base' as const,
            value:
              ability === 'strength' ? 18 : ability === 'dexterity' ? 14 : 10,
          })),
        ],
      },
      {
        _id: 'bab',
        ruleIdentity: 'bab',
        modifiers: [{ target: 'bab', bonusType: 'untyped', value: bab }],
      },
      {
        _id: 'longsword',
        name: 'Longsword',
        ruleIdentity: 'longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: 'longsword',
            proficiency: 'martial',
            handedness: 'oneHanded',
            attackType: 'melee',
            dice: '1d8',
            damageTypes: ['slashing'],
            threat: 19,
            mult: 2,
            strengthDamage: 'melee',
          },
        },
      },
    ],
  };
}

// CRB pp. 179, 182: BAB +11 grants three attacks at +11/+6/+1.
// CRB pp. 141, 179: a one-handed melee weapon adds full Strength to damage.
test('a named routine has one standard attack and its ordered BAB iteratives', () => {
  const routine = calculateCharacterSheet(attackSheet()).attackRoutines[0];
  expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
    15, 10, 5,
  ]);
  expect(routine?.single[0]).toMatchObject({
    damageDice: '1d8',
    damageBonus: { total: 4 },
    criticalThreat: { total: 19 },
    criticalMultiplier: { total: 2 },
    rangeIncrement: null,
  });
});

test('attack number lookups retain provenance for single and full attacks', async () => {
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  const calculated = calculateCharacterSheet(attackSheet());
  const target = {
    kind: 'attackRoutine',
    entryId: 'routine',
    sequence: 'full',
    attackIndex: 1,
    statistic: 'attackBonus',
  } as const;
  expect(findCharacterSheetStatistic(calculated, target)).toMatchObject({
    total: 10,
    applied: expect.arrayContaining([
      expect.objectContaining({ entryName: 'Strength', value: 4 }),
      expect.objectContaining({ sheetEntryId: 'bab-row', value: 11 }),
      expect.objectContaining({ entryName: 'Iterative attack 2', value: -5 }),
    ]),
  });
});

test.each([
  ['melee', 'Strength', 'str', 4, 4],
  ['ranged', 'Dexterity', 'dex', 2, 0],
] as const)(
  '%s ability and iterative contributions credit ability and BAB rather than the weapon',
  (mode, label, ability, attackValue, damageValue) => {
    const input = attackSheet();
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? { ...entry, state: { ...entry.state, mode } }
          : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.single[0]?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: label,
        source: `builtin:ability.${ability}`,
        sheetEntryId: `builtin:ability.${ability}`,
        value: attackValue,
      }),
    );
    expect(routine?.single[0]?.damageBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: 'Strength to damage',
        source: 'builtin:ability.str',
        sheetEntryId: 'builtin:ability.str',
        value: damageValue,
      }),
    );
    expect(routine?.full[1]?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        entryName: 'Iterative attack 2',
        source: 'builtin:bab',
        sheetEntryId: 'builtin:bab',
        value: -5,
      }),
    );
    expect(routine?.single[0]?.criticalThreat.applied).toContainEqual(
      expect.objectContaining({
        source: 'weapon-row',
        sheetEntryId: 'weapon-row',
      }),
    );
  },
);

// CRB pp. 141, 179 and the ranged-weapon descriptions, pp. 144–149.
test.each([
  ['longsword', 'one', 'melee', 18, 15, 4, null],
  ['longsword', 'two', 'melee', 18, 15, 6, null],
  ['dagger', 'two', 'melee', 18, 15, 4, null],
  ['greatsword', 'two', 'melee', 7, 9, -2, null],
  ['spear', 'two', 'thrown', 18, 13, 4, 20],
  ['spear', 'two', 'thrown', 7, 13, -2, 20],
  ['longbow', 'two', 'ranged', 18, 13, 0, 100],
  ['longbow', 'two', 'ranged', 7, 13, -2, 100],
  ['composite-longbow-2', 'two', 'ranged', 18, 13, 2, 110],
  ['composite-longbow-2', 'two', 'ranged', 12, 11, 1, 110],
  ['light-crossbow', 'two', 'ranged', 7, 13, 0, 80],
  ['sling', 'one', 'ranged', 18, 13, 4, 50],
] as const)(
  'CRB %s in %s hand(s), %s mode, Strength %s resolves attack and damage',
  async (weaponId, hands, mode, strength, attack, damage, range) => {
    const { representativeWeaponCatalog } =
      await import('../../convex/lib/representativeWeaponCatalog');
    const input = attackSheet();
    const sheet: CharacterSheetInput = {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: weaponId }
          : entry.kind === 'attackRoutine'
            ? { ...entry, state: { ...entry.state, hands, mode } }
            : entry.kind === 'base'
              ? {
                  ...entry,
                  state: {
                    ...entry.state,
                    proficiencies: {
                      added: [{ category: 'martial' }, { category: 'simple' }],
                      removed: [],
                    },
                  },
                }
              : entry,
      ),
      catalogEntries: [
        ...input.catalogEntries
          .filter((entry) => entry._id !== 'longsword')
          .map((entry) =>
            entry._id === 'base'
              ? {
                  ...entry,
                  modifiers: entry.modifiers.map((modifier) =>
                    modifier.target === 'ability.str'
                      ? { ...modifier, value: strength }
                      : modifier,
                  ),
                }
              : entry,
          ),
        ...representativeWeaponCatalog.map((weapon) => ({
          ...weapon,
          _id: weapon.ruleIdentity,
        })),
      ],
    };
    const line = calculateCharacterSheet(sheet).attackRoutines[0]?.single[0];
    expect(line?.attackBonus.total).toBe(attack);
    expect(line?.damageBonus.total).toBe(damage);
    expect(line?.rangeIncrement?.total ?? null).toBe(range);
  },
);

test.each([0, 5, 6, 10, 11, 15, 16, 20])(
  'CRB BAB %s controls only full-attack iteratives',
  (bab) => {
    const routine = calculateCharacterSheet(attackSheet(bab)).attackRoutines[0];
    const expected = bab < 6 ? 1 : bab < 11 ? 2 : bab < 16 ? 3 : 4;
    expect(routine?.single).toHaveLength(1);
    expect(routine?.full).toHaveLength(expected);
  },
);

test('a missing weapon preserves its routine and emits an addressable warning', () => {
  const input = attackSheet();
  const result = calculateCharacterSheet({
    ...input,
    entries: input.entries.filter((entry) => entry.kind !== 'item'),
  });
  expect(result.attackRoutines[0]).toMatchObject({
    entryId: 'routine',
    name: 'Sword',
    weaponEntryId: 'weapon-row',
    single: [],
    full: [],
  });
  expect(result.warnings).toContainEqual(
    expect.objectContaining({
      check: 'missingAttackWeapon',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('a switched-off weapon keeps its routine with a distinct warning and no attack lines', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item' ? { ...entry, active: false } : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [],
    full: [],
    warnings: [
      expect.objectContaining({
        check: 'inactiveAttackWeapon',
        message: expect.stringContaining('switched off'),
        target: { kind: 'entry', entryId: 'routine' },
      }),
    ],
  });
});

test('a dormant weapon keeps its routine without contributing attacks or proficiency uses', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item'
        ? {
            ...entry,
            grantKey: { source: 'missing-source', entry: 'longsword' },
          }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [],
    full: [],
    warnings: [
      expect.objectContaining({
        check: 'unavailableAttackWeapon',
        target: { kind: 'entry', entryId: 'routine' },
      }),
    ],
  });
  expect(calculated.weaponProficiencies).toEqual([]);
});

test.each(['non-item', 'non-weapon'] as const)(
  'a %s reference warns on its routine without pretending it left Gear',
  (kind) => {
    const input = attackSheet();
    const calculated = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine' && kind === 'non-item'
          ? { ...entry, state: { ...entry.state, weaponEntryId: 'bab-row' } }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'longsword' && kind === 'non-weapon'
          ? { ...entry, detail: { kind: 'item' } }
          : entry,
      ),
    });
    expect(calculated.attackRoutines[0]).toMatchObject({
      single: [],
      warnings: [
        expect.objectContaining({
          check: 'invalidAttackWeapon',
          target: { kind: 'entry', entryId: 'routine' },
        }),
      ],
    });
  },
);

test('switched-off and missing weapons supply no routine uses for proficiency checks', () => {
  const input = attackSheet();
  expect(
    attackRoutineWeaponUses({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item' ? { ...entry, active: false } : entry,
      ),
    }),
  ).toEqual([]);
  expect(
    attackRoutineWeaponUses({
      ...input,
      entries: input.entries.filter((entry) => entry.kind !== 'item'),
    }),
  ).toEqual([]);
});

// CRB p. 141: two-handed weapons require two hands. The choice remains advisory.
test('one-handed use of a greatsword warns without blocking its routine', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((entry) =>
      entry.detail?.kind === 'item' && entry.detail.weapon
        ? {
            ...entry,
            name: 'Greatsword',
            detail: {
              ...entry.detail,
              weapon: {
                ...entry.detail.weapon,
                handedness: 'twoHanded',
                dice: '2d6',
              },
            },
          }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]?.single).toHaveLength(1);
  expect(calculated.attackRoutines[0]?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsuitableAttackHands',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

// CRB p. 141, thrown weapons: throwing a melee weapon not designed to be
// thrown gives -4 to attack and a 10-foot range increment, with full Strength.
test('throwing a longsword applies the improvised throw penalty and range with an advisory warning', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, mode: 'thrown' } }
        : entry,
    ),
  });
  expect(calculated.attackRoutines[0]).toMatchObject({
    single: [
      {
        attackBonus: { total: 9 },
        damageBonus: { total: 4 },
        rangeIncrement: { total: 10 },
      },
    ],
    warnings: [expect.objectContaining({ check: 'unsuitableAttackMode' })],
  });
});

test('throwing a nonproficient longsword applies the improvised nonproficiency penalty once', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, mode: 'thrown' } }
        : entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: { added: [], removed: [] },
              },
            }
          : entry,
    ),
  });
  // CRB p. 144: improvised weapons count as nonproficient (-4).
  // BAB +11 and Dexterity +2 therefore give +9, even without sword proficiency.
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(9);
  expect(
    calculated.attackRoutines[0]?.full.map((line) => line.attackBonus.total),
  ).toEqual([9, 4, -1]);
});

test.each(['melee', 'ranged'] as const)(
  'a weapon used in an unsuitable %s mode warns but keeps the chosen mode',
  (mode) => {
    const input = attackSheet();
    const calculated = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? { ...entry, state: { ...entry.state, mode } }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry.detail?.kind === 'item' && entry.detail.weapon
          ? {
              ...entry,
              detail: {
                ...entry.detail,
                weapon: {
                  ...entry.detail.weapon,
                  attackType: mode === 'melee' ? 'ranged' : 'melee',
                },
              },
            }
          : entry,
      ),
    });
    expect(calculated.attackRoutines[0]?.single[0]?.mode).toBe(mode);
    expect(calculated.attackRoutines[0]?.warnings).toContainEqual(
      expect.objectContaining({ check: 'unsuitableAttackMode' }),
    );
  },
);

test('grappled keeps invisibility attack modifiers suppressed in routine lines', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet(
    {
      ...input,
      entries: [
        ...input.entries,
        ...(['grappled', 'invisible'] as const).map((condition) => ({
          _id: condition,
          kind: 'condition' as const,
          active: true,
          catalogEntryId: condition,
          state: { kind: 'condition' as const },
        })),
      ],
      catalogEntries: [
        ...input.catalogEntries,
        ...(['grappled', 'invisible'] as const).map((condition) => ({
          _id: condition,
          name: condition,
          ruleIdentity: condition,
          modifiers:
            condition === 'invisible'
              ? [
                  {
                    target: 'attack.melee' as const,
                    bonusType: 'untyped' as const,
                    value: 2,
                  },
                ]
              : [],
          detail: { kind: 'condition' as const, conditionKey: condition },
        })),
      ],
    },
    { situations: ['sighted-opponent'] },
  );
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(13);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.suppressed,
  ).toContainEqual(
    expect.objectContaining({ sheetEntryId: 'invisible', value: 2 }),
  );
});

// #306 composition: owning a weapon is insufficient; its routine's hand use
// selects the bastard sword's named exotic requirement (CRB p. 145).
test('real one-handed exotic routines apply minus four and warn, while two hands use martial training', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const sheet: CharacterSheetInput = {
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'bastard-sword' }
          : entry,
      ),
      {
        _id: 'two-hands',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Two hands',
          weaponEntryId: 'weapon-row',
          hands: 'two',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  };
  const calculated = calculateCharacterSheet(sheet);
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.attackBonus.total,
    ),
  ).toEqual([11, 15]);
  expect(calculated.weaponProficiencies).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        entryId: 'weapon-row',
        hands: 'one',
        attackPenalty: -4,
      }),
      expect.objectContaining({
        entryId: 'weapon-row',
        hands: 'two',
        attackPenalty: 0,
      }),
    ]),
  );
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'oneHandedExotic',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('two one-handed routines for the same exotic weapon each own exactly one warning', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'bastard-sword' }
          : entry,
      ),
      {
        _id: 'second-routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Another swing',
          weaponEntryId: 'weapon-row',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  });
  expect(
    calculated.attackRoutines.map((routine) =>
      routine.warnings
        .filter((warning) => warning.check === 'oneHandedExotic')
        .map((warning) => warning.subject),
    ),
  ).toEqual([['routine'], ['second-routine']]);
  expect(
    calculated.warnings
      .filter((warning) => warning.check === 'oneHandedExotic')
      .map((warning) => warning.subject),
  ).toEqual(['routine', 'second-routine']);
});

test('routine exotic warnings reopen for relevant proficiency changes and ignore unrelated ones', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const sheet: CharacterSheetInput = {
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'item'
        ? { ...entry, catalogEntryId: 'bastard-sword' }
        : entry,
    ),
    catalogEntries: [
      ...input.catalogEntries,
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  };
  const fingerprint = (value: CharacterSheetInput) =>
    calculateCharacterSheet(value).attackRoutines[0]?.warnings.find(
      (warning) => warning.check === 'oneHandedExotic',
    )?.fingerprint;
  const before = fingerprint(sheet);
  expect(before).toBeDefined();
  expect(
    fingerprint({
      ...sheet,
      entries: sheet.entries.map((entry) =>
        entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: {
                  added: [{ category: 'martial' }, { baseType: 'longbow' }],
                  removed: [],
                },
              },
            }
          : entry,
      ),
    }),
  ).toBe(before);
  expect(
    fingerprint({
      ...sheet,
      entries: sheet.entries.map((entry) =>
        entry.kind === 'base'
          ? {
              ...entry,
              state: {
                ...entry.state,
                proficiencies: {
                  added: [{ category: 'martial' }],
                  removed: [{ baseType: 'bastard sword' }],
                },
              },
            }
          : entry,
      ),
    }),
  ).not.toBe(before);
});

test('armor penalties apply once and weapon enhancement stays local to its routine', () => {
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: [
      ...input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, state: { kind: 'item' as const, enhancement: 2 } }
          : entry,
      ),
      {
        _id: 'armor-row',
        kind: 'item',
        active: true,
        catalogEntryId: 'armor',
        state: { kind: 'item' },
      },
      {
        _id: 'plain-weapon',
        kind: 'item',
        active: true,
        catalogEntryId: 'longsword',
        state: { kind: 'item', masterwork: true },
      },
      {
        _id: 'plain-routine',
        kind: 'attackRoutine',
        active: true,
        state: {
          kind: 'attackRoutine',
          name: 'Masterwork sword',
          weaponEntryId: 'plain-weapon',
          hands: 'one',
          mode: 'melee',
        },
      },
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'armor',
        name: 'Full plate',
        ruleIdentity: 'full-plate',
        modifiers: [],
        detail: {
          kind: 'item',
          armor: { slot: 'armor', category: 'heavy', armorCheckPenalty: 6 },
        },
      },
    ],
  });
  // BAB +11, Str +4, nonproficient full plate -6, enhancements +2/+1.
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.attackBonus.total,
    ),
  ).toEqual([11, 10]);
  expect(
    calculated.attackRoutines.map(
      (routine) => routine.single[0]?.damageBonus.total,
    ),
  ).toEqual([6, 4]);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied.filter(
      (source) => source.sheetEntryId === 'armor-row',
    ),
  ).toHaveLength(1);
});

test('ranged nonproficiency and conditional formula modifiers use the current sheet projection', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet(
    {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'light-crossbow' }
          : entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: { ...entry.state, mode: 'ranged', hands: 'two' },
              }
            : entry,
      ),
      catalogEntries: [
        ...input.catalogEntries.map((entry) =>
          entry._id === 'bab'
            ? {
                ...entry,
                modifiers: [
                  ...entry.modifiers,
                  {
                    target: 'attack.ranged' as const,
                    bonusType: 'untyped' as const,
                    value: { formula: '@ability.dex.mod' },
                    condition: { situation: { local: 'on high ground' } },
                  },
                ],
              }
            : entry,
        ),
        ...representativeWeaponCatalog.map((weapon) => ({
          ...weapon,
          _id: weapon.ruleIdentity,
        })),
      ],
    },
    { situations: [{ local: 'on high ground', sheetEntryId: 'bab-row' }] },
  );
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(11);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied,
  ).toContainEqual(
    expect.objectContaining({
      entryName: 'Not proficient: Light crossbow',
      target: 'attack.ranged',
      value: -4,
    }),
  );
});

test('an underpowered nonproficient composite bow applies both distinct penalties', async () => {
  const { representativeWeaponCatalog } =
    await import('../../convex/lib/representativeWeaponCatalog');
  const input = attackSheet();
  const calculated = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'base'
        ? { ...entry, state: { kind: 'base' } }
        : entry.kind === 'item'
          ? { ...entry, catalogEntryId: 'composite-longbow-2' }
          : entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: { ...entry.state, mode: 'ranged', hands: 'two' },
              }
            : entry,
    ),
    catalogEntries: [
      ...input.catalogEntries.map((entry) =>
        entry._id === 'base'
          ? {
              ...entry,
              modifiers: entry.modifiers.map((modifier) =>
                modifier.target === 'ability.str'
                  ? { ...modifier, value: 12 }
                  : modifier,
              ),
            }
          : entry,
      ),
      ...representativeWeaponCatalog.map((weapon) => ({
        ...weapon,
        _id: weapon.ruleIdentity,
      })),
    ],
  });
  // BAB +11, Dex +2, nonproficiency -4, insufficient Strength rating -2.
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(7);
});

// CRB Table 8–1: a Small attacker receives a +1 size modifier to attack.
test('routine attack bonuses include the current creature size', () => {
  const calculated = calculateCharacterSheet(attackSheet(), { size: 'small' });
  expect(calculated.attackRoutines[0]?.single[0]?.attackBonus.total).toBe(16);
  expect(
    calculated.attackRoutines[0]?.single[0]?.attackBonus.applied,
  ).toContainEqual(
    expect.objectContaining({ entryName: 'Size', value: 1, bonusType: 'size' }),
  );
});
