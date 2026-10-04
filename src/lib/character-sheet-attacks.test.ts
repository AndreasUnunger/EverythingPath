import { expect, test } from 'vitest';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  type CharacterSheetCatalogEntry,
  type CharacterSheetInput,
  type SheetEntry,
} from './character-sheet';
import { attackRoutineWeaponUses } from './character-sheet-attacks';

function pairedAttackSheet({
  light = false,
  feats = [],
}: { light?: boolean; feats?: string[] } = {}): CharacterSheetInput {
  const input = attackSheet();
  return {
    ...input,
    entries: [
      ...input.entries.map<SheetEntry>((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'off-weapon',
                  mode: 'melee' as const,
                },
              },
            }
          : entry,
      ),
      {
        _id: 'off-weapon',
        kind: 'item',
        active: true,
        catalogEntryId: 'off-catalog',
        state: { kind: 'item' },
      },
      ...feats.map((feat) => ({
        _id: `row-${feat}`,
        kind: 'feat' as const,
        active: true,
        catalogEntryId: `copy-${feat}`,
        state: { kind: 'feat' as const },
      })),
    ],
    catalogEntries: [
      ...input.catalogEntries,
      {
        _id: 'off-catalog',
        name: light ? 'Short sword' : 'Longsword',
        ruleIdentity: light ? 'short-sword' : 'longsword',
        modifiers: [],
        detail: {
          kind: 'item',
          weapon: {
            baseType: light ? 'short sword' : 'longsword',
            proficiency: 'martial',
            handedness: light ? 'light' : 'oneHanded',
            attackType: 'melee',
            dice: light ? '1d6' : '1d8',
            threat: 19,
            mult: 2,
            strengthDamage: 'melee',
          },
        },
      },
      ...feats.map((feat) => ({
        _id: `copy-${feat}`,
        name: 'Renamed catalog copy',
        ruleIdentity: feat,
        modifiers: [],
        detail: { kind: 'feat' as const },
      })),
    ],
  };
}

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

// CRB p. 202, Table 8–7: https://legacy.aonprd.com/coreRulebook/combat.html#two-weapon-fighting
test('two normal weapons apply minus six/minus ten only to the full attack', () => {
  const routine =
    calculateCharacterSheet(pairedAttackSheet()).attackRoutines[0];
  expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
    9, 4, -1, 5,
  ]);
  expect(routine?.full.map((line) => line.hand)).toEqual([
    'main',
    'main',
    'main',
    'off',
  ]);
  expect(routine?.full[3]?.damageBonus.total).toBe(2);
});

test.each(['missing', 'inactive'] as const)(
  'an %s main weapon still reports the named off-hand warning with stable acceptance facts',
  (main) => {
    const input = pairedAttackSheet({ light: true });
    const offInactive: CharacterSheetInput = {
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'item' && entry._id === 'off-weapon'
          ? { ...entry, active: false }
          : entry,
      ),
    };
    const before = calculateCharacterSheet(offInactive).attackRoutines[0];
    const after = calculateCharacterSheet({
      ...offInactive,
      entries: offInactive.entries
        .filter((entry) => main !== 'missing' || entry._id !== 'weapon-row')
        .map((entry) =>
          main === 'inactive' &&
          entry.kind === 'item' &&
          entry._id === 'weapon-row'
            ? { ...entry, active: false }
            : entry,
        ),
    }).attackRoutines[0];
    const warning = before?.warnings.find(
      (row) => row.subject === 'routine:off',
    );
    expect(warning?.message).toBe(
      'Off hand: Short sword is switched off. Switch it on in Gear or choose another weapon. Off-hand attacks are skipped.',
    );
    expect(after?.warnings).toContainEqual(warning);
    expect(after?.single).toEqual([]);
    expect(after?.full).toEqual([]);
  },
);

// CRB p. 202, Table 8–7, the other three rows (same source as above).
test.each([
  { light: true, feats: [], attacks: [11, 6, 1, 7] },
  { light: false, feats: ['two-weapon-fighting'], attacks: [11, 6, 1, 11] },
  { light: true, feats: ['two-weapon-fighting'], attacks: [13, 8, 3, 13] },
])(
  'CRB two-weapon penalties with light=$light and feats=$feats',
  ({ light, feats, attacks }) => {
    const routine = calculateCharacterSheet(pairedAttackSheet({ light, feats }))
      .attackRoutines[0];
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual(
      attacks,
    );
    expect(routine?.single.map((line) => line.attackBonus.total)).toEqual([15]);
  },
);

test('the full-attack penalty breakdown credits the active Two-Weapon Fighting Selection', async () => {
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  const calculated = calculateCharacterSheet(
    pairedAttackSheet({
      light: true,
      feats: ['two-weapon-fighting'],
    }),
  );
  for (const attackIndex of [0, 3]) {
    expect(
      findCharacterSheetStatistic(calculated, {
        kind: 'attackRoutine',
        entryId: 'routine',
        sequence: 'full',
        attackIndex,
        statistic: 'attackBonus',
      })?.applied,
    ).toContainEqual(
      expect.objectContaining({
        sheetEntryId: 'row-two-weapon-fighting',
        entryName: 'Two-weapon fighting',
        value: -2,
      }),
    );
  }
  expect(calculated.attackRoutines[0]?.twoWeaponPenaltySummary).toBe(
    'Two-weapon fighting, light off hand: −2 primary, −2 off hand',
  );
  expect(
    calculateCharacterSheet(attackSheet()).attackRoutines[0]
      ?.twoWeaponPenaltySummary,
  ).toBeNull();
});

test('ordinary seeded Greater Two-Weapon Fighting warns about missing prerequisites while retaining its attack', async () => {
  const { representativeSelectionCatalog } =
    await import('../../convex/lib/representativeSelectionCatalog');
  const input = pairedAttackSheet({
    light: true,
    feats: ['greater-two-weapon-fighting'],
  });
  const calculated = calculateCharacterSheet({
    ...input,
    catalogEntries: input.catalogEntries.map((definition) => {
      const seeded = representativeSelectionCatalog.find(
        (candidate) => candidate.ruleIdentity === definition.ruleIdentity,
      );
      return seeded
        ? { ...seeded, _id: definition._id, name: 'Renamed catalog copy' }
        : definition;
    }),
  });
  expect(
    calculated.attackRoutines[0]?.full
      .filter((line) => line.hand === 'off')
      .map((line) => line.attackBonus.total),
  ).toEqual([7, -3]);
  expect(calculated.warnings).toContainEqual(
    expect.objectContaining({
      check: 'prerequisites.current',
      target: { kind: 'entry', entryId: 'row-greater-two-weapon-fighting' },
    }),
  );
});

test('weapon proficiency uses keep the routine identity and identify each hand explicitly', () => {
  expect(attackRoutineWeaponUses(pairedAttackSheet())).toEqual([
    {
      entryId: 'weapon-row',
      routineEntryId: 'routine',
      hand: 'main',
      hands: 'one',
      attack: 'melee',
    },
    {
      entryId: 'off-weapon',
      routineEntryId: 'routine',
      hand: 'off',
      hands: 'one',
      attack: 'melee',
    },
  ]);
});

// CRB pp. 125, 127: Improved/Greater Two-Weapon Fighting add -5/-10 off-hand attacks.
// https://legacy.aonprd.com/coreRulebook/feats.html#improved-two-weapon-fighting
// https://legacy.aonprd.com/coreRulebook/feats.html#greater-two-weapon-fighting
test.each([
  {
    feats: ['two-weapon-fighting', 'improved-two-weapon-fighting'],
    attacks: [13, 8],
  },
  {
    feats: [
      'two-weapon-fighting',
      'improved-two-weapon-fighting',
      'greater-two-weapon-fighting',
    ],
    attacks: [13, 8, 3],
  },
  { feats: ['greater-two-weapon-fighting'], attacks: [7, -3] },
])(
  'active off-hand feats add exactly their attacks: $feats',
  ({ feats, attacks }) => {
    const routine = calculateCharacterSheet(
      pairedAttackSheet({ light: true, feats }),
    ).attackRoutines[0];
    expect(
      routine?.full
        .filter((line) => line.hand === 'off')
        .map((line) => line.attackBonus.total),
    ).toEqual(attacks);
    expect(routine?.single).toHaveLength(1);
    const extra = routine?.full.filter((line) => line.hand === 'off')[1];
    expect(extra?.attackBonus.applied).toContainEqual(
      expect.objectContaining({
        sheetEntryId: `row-${feats.includes('improved-two-weapon-fighting') ? 'improved-two-weapon-fighting' : 'greater-two-weapon-fighting'}`,
      }),
    );
  },
);

// CRB p. 122, Double Slice; CRB p. 179, off-hand damage and full Strength penalties.
// https://legacy.aonprd.com/coreRulebook/feats.html#double-slice
test.each([
  { strength: 17, feats: [], damage: 1 },
  { strength: 17, feats: ['double-slice'], damage: 3 },
  { strength: 7, feats: [], damage: -2 },
  { strength: 7, feats: ['double-slice'], damage: -2 },
])(
  'off-hand Strength $strength with feats=$feats gives damage $damage',
  ({ strength, feats, damage }) => {
    const input = pairedAttackSheet({ light: true, feats });
    const routine = calculateCharacterSheet({
      ...input,
      catalogEntries: input.catalogEntries.map((entry) =>
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
    }).attackRoutines[0];
    expect(
      routine?.full.find((line) => line.hand === 'off')?.damageBonus.total,
    ).toBe(damage);
  },
);

// CRB pp. 143, 147: gnome hooked hammer is 1d8/×3 and 1d6/×4.
// CRB p. 202: the second end counts as light for two-weapon penalties.
// Decision #237 A10: primary full-attack end adds Str ×1; single end in two hands ×1½.
test.each([false, true])(
  'double ends retain separate weapon statistics and enchantments (Double Slice=$doubleSlice)',
  (doubleSlice) => {
    const input = attackSheet();
    const featInput = pairedAttackSheet({ feats: ['double-slice'] });
    const routine = calculateCharacterSheet({
      ...input,
      entries: [
        ...input.entries.map<SheetEntry>((entry) =>
          entry.kind === 'attackRoutine'
            ? {
                ...entry,
                state: {
                  ...entry.state,
                  hands: 'two',
                  offHand: { kind: 'otherEnd', mode: 'melee' },
                },
              }
            : entry.kind === 'item'
              ? {
                  ...entry,
                  state: {
                    kind: 'item',
                    enhancement: 2,
                    otherEnd: { masterwork: true },
                  },
                }
              : entry,
        ),
        ...(doubleSlice
          ? featInput.entries.filter((entry) => entry.kind === 'feat')
          : []),
      ],
      catalogEntries: [
        ...input.catalogEntries.map<CharacterSheetCatalogEntry>((entry) =>
          entry._id === 'longsword'
            ? {
                ...entry,
                name: 'Gnome hooked hammer',
                detail: {
                  kind: 'item',
                  weapon: {
                    baseType: 'gnome hooked hammer',
                    proficiency: 'always',
                    handedness: 'twoHanded',
                    attackType: 'melee',
                    strengthDamage: 'melee',
                    dice: '1d8',
                    threat: 20,
                    mult: 3,
                    damageTypes: ['bludgeoning'],
                    otherEnd: {
                      dice: '1d6',
                      threat: 20,
                      mult: 4,
                      damageTypes: ['piercing'],
                    },
                  },
                },
              }
            : entry,
        ),
        ...(doubleSlice
          ? featInput.catalogEntries.filter(
              (entry) => entry.detail?.kind === 'feat',
            )
          : []),
      ],
    }).attackRoutines[0];
    expect(routine?.single[0]).toMatchObject({
      attackBonus: { total: 17 },
      damageBonus: { total: 8 },
      hand: 'main',
      end: 'primary',
    });
    expect(routine?.full[0]).toMatchObject({
      attackBonus: { total: 13 },
      damageBonus: { total: 6 },
      damageDice: '1d8',
      criticalMultiplier: { total: 3 },
    });
    expect(routine?.full[3]).toMatchObject({
      attackBonus: { total: 8 },
      damageBonus: { total: doubleSlice ? 4 : 2 },
      hand: 'off',
      end: 'otherEnd',
      damageDice: '1d6',
      damageType: 'piercing',
      criticalMultiplier: { total: 4 },
      weaponEntryId: 'weapon-row',
    });
  },
);

test.each(['missing', 'inactive', 'same-row', 'not-double'] as const)(
  'an invalid %s off hand remains recorded and warns while keeping the main attack',
  (configuration) => {
    const input = pairedAttackSheet();
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand:
                  configuration === 'not-double'
                    ? { kind: 'otherEnd', mode: 'melee' }
                    : {
                        kind: 'weapon',
                        weaponEntryId:
                          configuration === 'missing'
                            ? 'gone'
                            : configuration === 'same-row'
                              ? 'weapon-row'
                              : 'off-weapon',
                        mode: 'melee',
                      },
              },
            }
          : entry.kind === 'item' &&
              entry._id === 'off-weapon' &&
              configuration === 'inactive'
            ? { ...entry, active: false }
            : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.single).toHaveLength(1);
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
      15, 10, 5,
    ]);
    expect(routine?.offHand).toBeDefined();
    expect(routine?.warnings).toContainEqual(
      expect.objectContaining({
        check:
          configuration === 'missing'
            ? 'missingAttackWeapon'
            : configuration === 'inactive'
              ? 'inactiveAttackWeapon'
              : 'invalidAttackOffHand',
        target: { kind: 'entry', entryId: 'routine' },
        subject: 'routine:off',
      }),
    );
  },
);

// CRB p. 141: two-handed weapons require both hands; suitability remains advisory.
test('two hands occupied by the main weapon warns while retaining both chosen weapons', () => {
  const input = pairedAttackSheet();
  const routine = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? { ...entry, state: { ...entry.state, hands: 'two' } }
        : entry,
    ),
  }).attackRoutines[0];
  expect(routine?.full).toHaveLength(4);
  expect(routine?.warnings).toContainEqual(
    expect.objectContaining({
      check: 'unsuitableAttackOffHand',
      target: { kind: 'entry', entryId: 'routine' },
    }),
  );
});

test('each hand applies its own proficiency penalty and mode', () => {
  const input = pairedAttackSheet({
    light: true,
    feats: ['two-weapon-fighting'],
  });
  const routine = calculateCharacterSheet({
    ...input,
    entries: input.entries.map((entry) =>
      entry.kind === 'attackRoutine'
        ? {
            ...entry,
            state: {
              ...entry.state,
              offHand: {
                kind: 'weapon',
                weaponEntryId: 'off-weapon',
                mode: 'thrown',
              },
            },
          }
        : entry,
    ),
    catalogEntries: input.catalogEntries.map((entry) =>
      entry._id === 'off-catalog'
        ? {
            ...entry,
            detail: {
              kind: 'item',
              weapon: {
                baseType: 'dagger',
                proficiency: 'simple',
                handedness: 'light',
                attackType: 'melee',
                dice: '1d4',
                threat: 19,
                mult: 2,
                thrown: true,
                thrownRangeIncrement: 10,
                strengthDamage: 'melee',
              },
            },
          }
        : entry,
    ),
  }).attackRoutines[0];
  expect(routine?.full[0]?.attackBonus.total).toBe(13);
  // Dex +2, BAB +11, TWF -2 and nonproficiency -4 = +7.
  expect(routine?.full[3]).toMatchObject({
    mode: 'thrown',
    attackBonus: { total: 7 },
    damageBonus: { total: 2 },
    rangeIncrement: { total: 10 },
  });
});

// CRB pp. 147, 179: a composite bow adds Strength only up to its rating;
// off-hand damage then halves the positive bonus. This unusual hand choice is advisory.
test.each([false, true])(
  'an off-hand composite bow caps Strength before its hand multiplier (Double Slice=%s)',
  (doubleSlice) => {
    const input = pairedAttackSheet({
      feats: doubleSlice ? ['double-slice'] : [],
    });
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'attackRoutine'
          ? {
              ...entry,
              state: {
                ...entry.state,
                offHand: {
                  kind: 'weapon',
                  weaponEntryId: 'off-weapon',
                  mode: 'ranged',
                },
              },
            }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry._id === 'off-catalog'
          ? {
              ...entry,
              name: 'Composite longbow (+3)',
              detail: {
                kind: 'item',
                weapon: {
                  baseType: 'longbow',
                  proficiency: 'martial',
                  handedness: 'twoHanded',
                  attackType: 'ranged',
                  dice: '1d8',
                  threat: 20,
                  mult: 3,
                  strengthDamage: 'compositeBow',
                  strengthRating: 3,
                },
              },
            }
          : entry,
      ),
    }).attackRoutines[0];
    expect(
      routine?.full.find((line) => line.hand === 'off')?.damageBonus.total,
    ).toBe(doubleSlice ? 3 : 1);
    expect(routine?.warnings).toContainEqual(
      expect.objectContaining({
        check: 'unsuitableAttackHands',
        subject: 'routine:off',
      }),
    );
  },
);

test.each(['inactive', 'dormant', 'impostor'] as const)(
  '$state attack feats cannot alter the routine',
  (state) => {
    const input = pairedAttackSheet({
      light: true,
      feats: [
        'two-weapon-fighting',
        'improved-two-weapon-fighting',
        'greater-two-weapon-fighting',
        'double-slice',
      ],
    });
    const routine = calculateCharacterSheet({
      ...input,
      entries: input.entries.map((entry) =>
        entry.kind === 'feat'
          ? {
              ...entry,
              active: state !== 'inactive',
              ...(state === 'dormant'
                ? {
                    grantKey: {
                      source: 'missing-source',
                      entry: entry.catalogEntryId,
                    },
                  }
                : {}),
            }
          : entry,
      ),
      catalogEntries: input.catalogEntries.map((entry) =>
        entry.detail?.kind === 'feat' && state === 'impostor'
          ? {
              ...entry,
              name: entry.ruleIdentity,
              ruleIdentity: `unrelated-${entry.ruleIdentity}`,
            }
          : entry,
      ),
    }).attackRoutines[0];
    expect(routine?.full.map((line) => line.attackBonus.total)).toEqual([
      11, 6, 1, 7,
    ]);
    expect(routine?.full[3]?.damageBonus.total).toBe(2);
  },
);

test('remapping renamed copies preserves active feat benefits and source breakdowns', async () => {
  const input = pairedAttackSheet({
    light: true,
    feats: [
      'two-weapon-fighting',
      'improved-two-weapon-fighting',
      'double-slice',
    ],
  });
  const calculated = calculateCharacterSheet(input);
  expect(
    calculated.attackRoutines[0]?.full.map((line) => line.attackBonus.total),
  ).toEqual([13, 8, 3, 13, 8]);
  const { findCharacterSheetStatistic } =
    await import('./character-sheet-breakdowns');
  expect(
    findCharacterSheetStatistic(calculated, {
      kind: 'attackRoutine',
      entryId: 'routine',
      sequence: 'full',
      attackIndex: 4,
      statistic: 'damageBonus',
    }),
  ).toMatchObject({
    total: 4,
    applied: expect.arrayContaining([
      expect.objectContaining({
        sheetEntryId: 'builtin:ability.str',
        value: 2,
      }),
      expect.objectContaining({
        sheetEntryId: 'row-double-slice',
        entryName: 'Double Slice',
        value: 2,
      }),
    ]),
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
