import { expect, test } from 'vitest';
import { calculateCharacterSheet } from './character-sheet';
import {
  prerequisiteSheet,
  selectedFeat,
} from './character-sheet-prerequisite-fixture';

test('an unfilled race prerequisite stays unresolved in both views', () => {
  const input = prerequisiteSheet(
    [selectedFeat('required')],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ race: ['race/elf'] }],
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(result.prerequisites.map(({ met }) => met)).toEqual([null, null]);
  expect(
    result.warnings.filter(({ check }) => check.startsWith('prerequisites.')),
  ).toEqual([]);
});

test('a racial trait prerequisite stays unresolved in both views until a race is chosen', () => {
  const input = prerequisiteSheet(
    [selectedFeat('required')],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ racialTrait: 'racial/elven-magic' }],
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(result.prerequisites.map(({ met }) => met)).toEqual([null, null]);
  expect(
    result.warnings.filter(({ check }) => check.startsWith('prerequisites.')),
  ).toEqual([]);
});

test('checks inclusive ability and BAB requirements using current facts and the recorded prefix', () => {
  const result = calculateCharacterSheet(
    prerequisiteSheet(
      [selectedFeat('power')],
      [
        {
          _id: 'power',
          name: 'Power Attack',
          ruleIdentity: 'feat/power',
          modifiers: [],
          detail: { kind: 'feat' },
          prerequisites: [{ ability: 'strength', min: 13 }, { bab: 1 }],
        },
      ],
    ),
  );
  expect(result.prerequisites.map(({ view, met }) => [view, met])).toEqual([
    ['current', false],
    ['recorded', false],
    ['current', true],
    ['recorded', true],
  ]);
  expect(
    result.warnings
      .filter(({ check }) => check.startsWith('prerequisites.'))
      .map(({ check }) => check),
  ).toEqual(['prerequisites.current', 'prerequisites.recordedLevel']);
});

test('recorded possession uses durable identities and earlier choices without recursively checking them', () => {
  const input = prerequisiteSheet(
    [selectedFeat('first', 0), selectedFeat('second', 1)],
    [
      {
        _id: 'first',
        ruleIdentity: 'feat/a',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/b' }],
      },
      {
        _id: 'second',
        ruleIdentity: 'feat/b',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/a' }],
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(
      ({ entryId, view, met }) => [entryId, view, met],
    ),
  ).toEqual([
    ['first', 'current', true],
    ['first', 'recorded', false],
    ['second', 'current', true],
    ['second', 'recorded', true],
  ]);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'first' ? { ...row, _id: 'copy', name: 'Edited copy' } : row,
  );
  input.entries = input.entries.map((row) =>
    row._id === 'first' && row.kind === 'feat'
      ? { ...row, catalogEntryId: 'copy' }
      : row,
  );
  expect(calculateCharacterSheet(input).prerequisites.at(-1)?.met).toBe(true);
});

test('equal or absent Selection orders use recorded row order at the same level', () => {
  const input = prerequisiteSheet(
    [selectedFeat('power'), selectedFeat('cleave')],
    [
      {
        _id: 'power',
        ruleIdentity: 'feat/power',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      {
        _id: 'cleave',
        ruleIdentity: 'feat/cleave',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/power' }],
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ met }) => met),
  ).toEqual([true, true]);
  input.entries = input.entries.map((entry) =>
    entry.kind === 'feat' ? { ...entry, choiceOrder: undefined } : entry,
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ met }) => met),
  ).toEqual([true, true]);
  input.entries = [
    ...input.entries.filter((entry) => entry.kind !== 'feat'),
    ...input.entries.filter((entry) => entry.kind === 'feat').reverse(),
  ];
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ met }) => met),
  ).toEqual([true, false]);
});

test('mixed recorded orders form one build order rather than cyclic prerequisite support', () => {
  const input = prerequisiteSheet(
    [
      selectedFeat('a', 1),
      { ...selectedFeat('b'), choiceOrder: undefined },
      selectedFeat('c', 0),
    ],
    [
      {
        _id: 'a',
        ruleIdentity: 'feat/a',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/c' }],
      },
      {
        _id: 'b',
        ruleIdentity: 'feat/b',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/a' }],
      },
      {
        _id: 'c',
        ruleIdentity: 'feat/c',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ feat: 'feat/b' }],
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(
      ({ entryId, view, met }) => [entryId, view, met],
    ),
  ).toEqual([
    ['a', 'current', true],
    ['a', 'recorded', true],
    ['b', 'current', true],
    ['b', 'recorded', true],
    ['c', 'current', true],
    ['c', 'recorded', false],
  ]);
});

test('evaluates race equivalence, racial traits, class families, features, alignment, deity and ranks', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'race',
        kind: 'race',
        catalogEntryId: 'half',
        active: true,
        state: { kind: 'race' },
      },
      {
        _id: 'feature',
        kind: 'classFeature',
        catalogEntryId: 'rage-uc',
        active: true,
        state: { kind: 'classFeature' },
      },
      selectedFeat('checks'),
    ],
    [
      {
        _id: 'half',
        ruleIdentity: 'race/half',
        countsAsRaces: ['race/elf'],
        modifiers: [],
        detail: { kind: 'race', racialTraits: ['senses'] },
      },
      {
        _id: 'senses',
        ruleIdentity: 'racial/senses',
        modifiers: [],
        detail: { kind: 'racialTrait', raceEntryIds: ['half'], replaces: [] },
      },
      {
        _id: 'rage',
        name: 'Rage',
        ruleIdentity: 'feature/rage',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'rage-uc',
        name: 'Rage (UC)',
        ruleIdentity: 'feature/rage-uc',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'checks',
        ruleIdentity: 'feat/checks',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { race: ['race/elf'] },
          { racialTrait: 'racial/senses' },
          { classFeature: 'feature/rage' },
          { classLevel: 'class/fighter', min: 1 },
          { characterLevel: 1 },
          { skillRanks: 'skill.clm', min: 1 },
          { alignment: ['LG'] },
          { deity: 'Iomedae' },
        ],
      },
    ],
  );
  input.entries = input.entries.map((row) =>
    row.kind === 'base'
      ? { ...row, state: { ...row.state, alignment: 'LG', deity: ' iomedae ' } }
      : row.kind === 'classLevel'
        ? { ...row, state: { ...row.state, skillRanks: { clm: 1 } } }
        : row,
  );
  expect(
    calculateCharacterSheet(input).prerequisites.every(
      ({ met }) => met === true,
    ),
  ).toBe(true);
});

test('supported alternatives keep unresolved branches silent and legacy proficiency clauses appear in the general engine', () => {
  const input = prerequisiteSheet(
    [selectedFeat('mixed')],
    [
      {
        _id: 'mixed',
        ruleIdentity: 'feat/mixed',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          {
            anyOf: [
              { ability: 'strength', min: 13 },
              { unchecked: 'Special training' },
            ],
          },
          { anyOf: [{ bab: 5 }, { characterLevel: 1 }] },
        ],
        proficiencyPrerequisites: [
          { kind: 'proficiency', proficiency: { category: 'heavy' } },
        ],
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(result.prerequisites.map(({ met }) => met)).toEqual([
    null,
    null,
    true,
    true,
    false,
    false,
  ]);
  expect(
    result.warnings.filter(({ check }) => check.startsWith('prerequisites.')),
  ).toEqual([]);
  expect(result.proficiencyPrerequisites.map(({ met }) => met)).toEqual([
    false,
    false,
  ]);
});

test('recorded statistics exclude own grants, later levels and choices while keeping current equipment', () => {
  const input = prerequisiteSheet(
    [
      { ...selectedFeat('self'), gainedAtClassLevel: 'level-1' },
      {
        _id: 'level-2',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: 2,
          classEntryId: 'fighter',
          hpGained: 5,
          skillRanks: { clm: 3 },
        },
      },
      {
        _id: 'late-item',
        kind: 'item',
        catalogEntryId: 'belt',
        active: true,
        gainedAtClassLevel: 'level-2',
        state: { kind: 'item' },
      },
    ],
    [
      {
        _id: 'self',
        ruleIdentity: 'feat/self',
        modifiers: [],
        detail: { kind: 'feat' },
        grants: [{ catalogEntryId: 'strength' }],
        prerequisites: [
          { ability: 'strength', min: 13 },
          { bab: 2 },
          { skillRanks: 'skill.clm', min: 3 },
        ],
      },
      {
        _id: 'strength',
        ruleIdentity: 'feature/strength',
        modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 2 }],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'belt',
        ruleIdentity: 'item/belt',
        modifiers: [
          { target: 'ability.str', bonusType: 'enhancement', value: 1 },
        ],
        detail: { kind: 'item' },
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ view, met }) => [
      view,
      met,
    ]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
    ['current', true],
    ['recorded', false],
    ['current', true],
    ['recorded', false],
  ]);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'belt'
      ? {
          ...row,
          modifiers: [
            { target: 'ability.str', bonusType: 'enhancement', value: 3 },
          ],
        }
      : row,
  );
  expect(calculateCharacterSheet(input).prerequisites[1]?.met).toBe(true);
});

test('prestige entry precedes every first-level benefit and later prestige levels have no new entry check', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'prestige-1',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: 2,
          classEntryId: 'prestige',
          hpGained: 5,
          abilityIncrease: 'strength',
          skillRanks: { clm: 2 },
        },
      },
      {
        _id: 'prestige-2',
        kind: 'classLevel',
        active: true,
        state: {
          kind: 'classLevel',
          position: 3,
          classEntryId: 'prestige',
          hpGained: 5,
        },
      },
    ],
    [
      {
        _id: 'prestige',
        ruleIdentity: 'class/prestige',
        modifiers: [],
        detail: {
          kind: 'class',
          classKind: 'prestige',
          hitDie: 10,
          bab: 'full',
          saves: { fort: 'good', ref: 'poor', will: 'poor' },
          skillRanksPerLevel: 2,
        },
        prerequisites: [
          { ability: 'strength', min: 11 },
          { bab: 2 },
          { skillRanks: 'skill.clm', min: 2 },
        ],
      },
    ],
  );
  const checks = calculateCharacterSheet(input).prerequisites;
  expect(checks.map(({ view, met }) => [view, met])).toEqual([
    ['current', true],
    ['recorded', false],
    ['current', true],
    ['recorded', false],
    ['current', true],
    ['recorded', false],
  ]);
  expect(checks.every(({ entryId }) => entryId === 'prestige-1')).toBe(true);
});

test('automatic feats and only the selected exempt slot skip both prerequisite views', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'source',
        kind: 'classFeature',
        catalogEntryId: 'source',
        active: true,
        state: { kind: 'classFeature' },
      },
      {
        ...selectedFeat('normal'),
        selectionSource: {
          kind: 'slot',
          grantedBy: { kind: 'entry', entryId: 'source' },
          slotIndex: 0,
        },
      },
      {
        ...selectedFeat('exempt'),
        selectionSource: {
          kind: 'slot',
          grantedBy: { kind: 'entry', entryId: 'source' },
          slotIndex: 1,
        },
      },
    ],
    [
      {
        _id: 'source',
        ruleIdentity: 'feature/source',
        modifiers: [],
        detail: { kind: 'classFeature' },
        grants: [{ catalogEntryId: 'granted' }],
        grantsSlots: [
          { kind: 'feat', count: 1 },
          { kind: 'feat', count: 1, ignoresPrerequisites: true },
        ],
      },
      ...['normal', 'exempt', 'granted'].map((id) => ({
        _id: id,
        ruleIdentity: `feat/${id}`,
        modifiers: [],
        detail: { kind: 'feat' as const },
        prerequisites: [{ ability: 'strength' as const, min: 20 }],
      })),
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(
      ({ entryId, view, met }) => [entryId, view, met],
    ),
  ).toEqual([
    ['normal', 'current', false],
    ['normal', 'recorded', false],
  ]);
});

test('unavailable recorded links omit recorded checks and warnings fingerprint only relevant semantic facts', () => {
  const input = prerequisiteSheet(
    [{ ...selectedFeat('required'), gainedAtClassLevel: 'missing' }],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ ability: 'strength', min: 13 }],
      },
    ],
  );
  const before = calculateCharacterSheet(input);
  expect(before.prerequisites.map(({ view }) => view)).toEqual(['current']);
  const fingerprint = before.warnings.find(
    ({ check }) => check === 'prerequisites.current',
  )?.fingerprint;
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'required'
      ? { ...row, _id: 'remapped', name: 'Renamed copy' }
      : row._id === 'base'
        ? {
            ...row,
            modifiers: row.modifiers.map((modifier) =>
              modifier.target === 'ability.dex'
                ? { ...modifier, value: 12 }
                : modifier,
            ),
          }
        : row,
  );
  input.entries = input.entries.map((row) =>
    row.kind === 'feat' ? { ...row, catalogEntryId: 'remapped' } : row,
  );
  expect(
    calculateCharacterSheet(input).warnings.find(
      ({ check }) => check === 'prerequisites.current',
    )?.fingerprint,
  ).toBe(fingerprint);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'remapped'
      ? { ...row, prerequisites: [{ ability: 'strength', min: 14 }] }
      : row,
  );
  expect(
    calculateCharacterSheet(input).warnings.find(
      ({ check }) => check === 'prerequisites.current',
    )?.fingerprint,
  ).not.toBe(fingerprint);
});

test('adding schema discriminants preserves ordinary prerequisite warning fingerprints', () => {
  const input = prerequisiteSheet(
    [selectedFeat('required')],
    [
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { ability: 'strength', min: 20 },
          { anyOf: [{ bab: 5 }, { ability: 'strength', min: 20 }] },
        ],
      },
    ],
  );
  const fingerprints = () =>
    calculateCharacterSheet(input)
      .warnings.filter(({ check }) => check.startsWith('prerequisites.'))
      .map(({ fingerprint }) => fingerprint);
  const before = fingerprints();
  expect(before).toHaveLength(4);
  input.catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'required'
      ? {
          ...entry,
          prerequisites: [
            { kind: 'ability', ability: 'strength', min: 20 },
            {
              anyOf: [
                { kind: 'bab', bab: 5 },
                { kind: 'ability', ability: 'strength', min: 20 },
              ],
            },
          ],
        }
      : entry,
  );
  expect(fingerprints()).toEqual(before);
});

test('race prerequisite fingerprints follow current racial identities while copies and unrelated racial facts stay stable', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'race-row',
        kind: 'race',
        catalogEntryId: 'race',
        active: true,
        state: { kind: 'race' },
      },
      selectedFeat('required'),
    ],
    [
      {
        _id: 'race',
        ruleIdentity: 'race/human',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [] },
      },
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ race: ['race/elf'] }],
      },
    ],
  );
  const fingerprints = () =>
    calculateCharacterSheet(input)
      .warnings.filter(({ check }) => check.startsWith('prerequisites.'))
      .map(({ fingerprint }) => fingerprint);
  const human = fingerprints();
  expect(human).toHaveLength(2);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'race' ? { ...row, ruleIdentity: 'race/dwarf' } : row,
  );
  const dwarf = fingerprints();
  expect(dwarf).toHaveLength(2);
  expect(dwarf[0]).not.toBe(human[0]);
  expect(dwarf[1]).not.toBe(human[1]);
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'race'
      ? {
          ...row,
          _id: 'copy',
          name: 'Copied dwarf',
          detail: { kind: 'race', size: 'small', racialTraits: [] },
        }
      : row,
  );
  input.entries = input.entries.map((row) =>
    row.kind === 'race' ? { ...row, catalogEntryId: 'copy' } : row,
  );
  expect(fingerprints()).toEqual(dwarf);
});

test('named feat choice fingerprints track only normalized choices of the required durable rule identity', () => {
  const input = prerequisiteSheet(
    [
      {
        ...selectedFeat('held'),
        state: { kind: 'feat', slot: 'general', choice: 'longsword' },
      },
      selectedFeat('required', 1),
      selectedFeat('unrelated', 2),
      {
        _id: 'race-row',
        kind: 'race',
        catalogEntryId: 'race',
        active: true,
        state: { kind: 'race' },
      },
    ],
    [
      {
        _id: 'race',
        ruleIdentity: 'race/human',
        modifiers: [],
        detail: { kind: 'race', racialTraits: [] },
      },
      {
        _id: 'held',
        ruleIdentity: 'feat/focus',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      {
        _id: 'unrelated',
        ruleIdentity: 'feat/unrelated',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { feat: 'feat/focus', choice: 'shortbow' },
          { racialTrait: 'racial/elven-magic' },
        ],
      },
    ],
  );
  const fingerprints = () =>
    calculateCharacterSheet(input)
      .warnings.filter(({ check }) => check.startsWith('prerequisites.'))
      .map(({ fingerprint }) => fingerprint);
  const before = fingerprints();
  expect(before).toHaveLength(4);
  input.entries = input.entries.map((row) =>
    row._id === 'held' && row.kind === 'feat'
      ? { ...row, state: { ...row.state, choice: 'battleaxe' } }
      : row,
  );
  const changed = fingerprints();
  expect(changed[0]).not.toBe(before[0]);
  expect(changed[1]).not.toBe(before[1]);
  expect(changed.slice(2)).toEqual(before.slice(2));
  input.entries = input.entries.map((row) =>
    row.kind === 'feat'
      ? row._id === 'held'
        ? {
            ...row,
            catalogEntryId: 'copy',
            state: { ...row.state, choice: ' BATTLEAXE ' },
          }
        : row._id === 'unrelated'
          ? { ...row, state: { ...row.state, choice: 'spear' } }
          : row
      : row,
  );
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'held' ? { ...row, _id: 'copy', name: 'Edited copy' } : row,
  );
  input.entries = [
    ...input.entries,
    {
      _id: 'racial-row',
      kind: 'racialTrait',
      catalogEntryId: 'senses',
      active: true,
      state: { kind: 'racialTrait' },
    },
  ];
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'senses',
      ruleIdentity: 'racial/senses',
      modifiers: [],
      detail: { kind: 'racialTrait', raceEntryIds: [], replaces: [] },
    },
  ];
  expect(fingerprints()).toEqual(changed);
});

test('retained feature names match Unchained features without loading an unavailable original', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'rage',
        kind: 'classFeature',
        catalogEntryId: 'rage',
        active: true,
        state: { kind: 'classFeature' },
      },
      selectedFeat('required'),
    ],
    [
      {
        _id: 'rage',
        name: 'Rage (UC)',
        ruleIdentity: 'feature/unchained-rage',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { classFeature: 'feature/original-rage', classFeatureName: 'Rage' },
        ],
      },
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ met }) => met),
  ).toEqual([true, true]);
});

test('a reconstructed automatic class feature cannot regenerate its own benefits', () => {
  const input = prerequisiteSheet(
    [],
    [
      {
        _id: 'automatic',
        ruleIdentity: 'feature/automatic',
        modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
        detail: { kind: 'classFeature' },
        prerequisites: [{ ability: 'strength', min: 13 }],
      },
    ],
  );
  input.catalogEntries = input.catalogEntries.map((row) =>
    row._id === 'fighter' && row.detail?.kind === 'class'
      ? {
          ...row,
          detail: {
            ...row.detail,
            featuresByLevel: [{ classLevel: 1, catalogEntryId: 'automatic' }],
          },
        }
      : row,
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(({ view, met }) => [
      view,
      met,
    ]),
  ).toEqual([
    ['current', true],
    ['recorded', false],
  ]);
});

test('recorded numeric facts keep same-level conditional activation distinct from an earlier prefix', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'item',
        kind: 'item',
        catalogEntryId: 'item',
        active: true,
        state: { kind: 'item' },
      },
      selectedFeat('before', 0),
      selectedFeat('trigger', 1),
      selectedFeat('after', 2),
    ],
    [
      {
        _id: 'item',
        ruleIdentity: 'item/strength',
        modifiers: [
          {
            target: 'ability.str',
            bonusType: 'untyped',
            value: 3,
            condition: { whileActive: 'trigger' },
          },
        ],
        detail: { kind: 'item' },
      },
      {
        _id: 'trigger',
        ruleIdentity: 'feat/trigger',
        modifiers: [],
        detail: { kind: 'feat' },
      },
      ...['before', 'after'].map((id) => ({
        _id: id,
        ruleIdentity: `feat/${id}`,
        modifiers: [],
        detail: { kind: 'feat' as const },
        prerequisites: [{ ability: 'strength' as const, min: 13 }],
      })),
    ],
  );
  expect(
    calculateCharacterSheet(input).prerequisites.map(
      ({ entryId, view, met }) => [entryId, view, met],
    ),
  ).toEqual([
    ['before', 'current', true],
    ['before', 'recorded', false],
    ['after', 'current', true],
    ['after', 'recorded', true],
  ]);
});

test('archetype replacements suppress feature prerequisites and feat slots, and restore them when turned off', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'archetype-row',
        kind: 'archetype',
        active: true,
        catalogEntryId: 'archetype',
        gainedAtClassLevel: 'level-1',
        choiceOrder: 0,
        state: { kind: 'archetype' },
      },
      selectedFeat('required', 1),
    ],
    [
      {
        _id: 'training',
        name: 'Combat Training',
        ruleIdentity: 'feature/training',
        modifiers: [],
        detail: { kind: 'classFeature' },
        grantsSlots: [{ kind: 'feat', count: 1, featTypes: ['combat'] }],
      },
      {
        _id: 'replacement',
        name: 'Alternate Training',
        ruleIdentity: 'feature/alternate-training',
        modifiers: [],
        detail: { kind: 'classFeature' },
      },
      {
        _id: 'archetype',
        name: 'Alternate Fighter',
        ruleIdentity: 'archetype/alternate-fighter',
        modifiers: [],
        detail: {
          kind: 'archetype',
          classEntryIds: ['fighter'],
          replaces: [{ classLevel: 1, catalogEntryId: 'training' }],
          adds: [{ classLevel: 1, catalogEntryId: 'replacement' }],
        },
      },
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [{ classFeature: 'feature/training' }],
      },
    ],
  );
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'fighter' && definition.detail?.kind === 'class'
      ? {
          ...definition,
          detail: {
            ...definition.detail,
            featuresByLevel: [{ classLevel: 1, catalogEntryId: 'training' }],
          },
        }
      : definition,
  );
  const withoutArchetype = calculateCharacterSheet({
    ...input,
    entries: input.entries.filter((entry) => entry.kind !== 'archetype'),
  });
  const bonusSlot = withoutArchetype.selectionRules.slots.find(
    (slot) => slot.grantedBy,
  );
  if (!bonusSlot?.grantedBy) throw new Error('Expected the feature feat slot');
  input.catalogEntries = [
    ...input.catalogEntries,
    {
      _id: 'bonus-feat',
      ruleIdentity: 'feat/bonus',
      modifiers: [],
      detail: { kind: 'feat', featTypes: ['combat'] },
    },
  ];
  input.entries = [
    ...input.entries,
    {
      ...selectedFeat('bonus-feat', 2),
      selectionSource: {
        kind: 'slot',
        grantedBy: bonusSlot.grantedBy,
        slotIndex: bonusSlot.slotIndex,
      },
      selectionSlot: { id: bonusSlot.id, position: 0 },
    },
  ];
  for (const active of [true, false, true, false]) {
    input.entries = input.entries.map((entry) =>
      entry.kind === 'archetype' && entry._id === 'archetype-row'
        ? { ...entry, active }
        : entry,
    );
    const result = calculateCharacterSheet(input);
    expect(result.prerequisites.map(({ view, met }) => [view, met])).toEqual([
      ['current', !active],
      ['recorded', !active],
    ]);
    expect(result.selectionRules.budgets.bonusFeats).toBe(active ? 0 : 1);
    expect(
      result.selectionRules.slots.find((slot) => slot.id === bonusSlot.id),
    ).toEqual(
      active
        ? undefined
        : expect.objectContaining({ count: 1, used: 1, remaining: 0 }),
    );
    expect(
      result.resolvedEntries.find(({ entry }) => entry._id === 'bonus-feat'),
    ).toMatchObject({ counting: !active, dormant: active });
    expect(
      result.resolvedEntries.find(
        ({ entry }) =>
          'catalogEntryId' in entry && entry.catalogEntryId === 'training',
      ),
    ).toMatchObject({ counting: !active, dormant: active });
  }
});

test('racial Hit Dice feed BAB, ranks and feat slots while character-level clauses count only Class Levels', () => {
  const input = prerequisiteSheet(
    [
      {
        _id: 'race-row',
        kind: 'race',
        active: true,
        catalogEntryId: 'racial-copy',
        state: {
          kind: 'race',
          racialHpGained: 12,
          racialSkillRanks: { per: 3 },
        },
      },
      selectedFeat('required'),
    ],
    [
      {
        _id: 'racial-copy',
        ruleIdentity: 'race/dragon',
        modifiers: [],
        detail: {
          kind: 'race',
          racialTraits: [],
          racialHitDice: 3,
          racialProgression: {
            creatureType: 'dragon',
            hitDie: 12,
            bab: 'full',
            saves: { fort: 'good', ref: 'good', will: 'good' },
            skillRanksPerHitDie: 6,
            classSkills: ['skill.per'],
          },
        },
      },
      {
        _id: 'required',
        ruleIdentity: 'feat/required',
        modifiers: [],
        detail: { kind: 'feat' },
        prerequisites: [
          { bab: 4 },
          { skillRanks: 'per', min: 3 },
          { characterLevel: 4 },
          { classLevel: 'class/fighter', min: 1 },
        ],
      },
    ],
  );
  const result = calculateCharacterSheet(input);
  expect(result.prerequisites.map(({ met }) => met)).toEqual([
    true,
    true,
    true,
    true,
    false,
    false,
    true,
    true,
  ]);
  expect(result).toMatchObject({
    level: 1,
    hitDice: 4,
    budgets: { generalFeats: 2 },
    selectionRules: { budgets: { generalFeats: 2 } },
  });
  input.catalogEntries = input.catalogEntries.map((definition) =>
    definition._id === 'racial-copy' && definition.detail?.kind === 'race'
      ? { ...definition, detail: { ...definition.detail, racialHitDice: 5 } }
      : definition,
  );
  expect(calculateCharacterSheet(input)).toMatchObject({
    hitDice: 6,
    budgets: { generalFeats: 3 },
    selectionRules: { budgets: { generalFeats: 3 } },
  });
  input.entries = input.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, active: false } : entry,
  );
  expect(calculateCharacterSheet(input)).toMatchObject({
    hitDice: 1,
    budgets: { generalFeats: 1 },
    selectionRules: { budgets: { generalFeats: 1 } },
  });
});
