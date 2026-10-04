import { expect, test } from 'vitest';
import { buildSheet } from './character-sheet-test-fixture';
import {
  buildCharacterSheetSelectionsView,
  previewSelectionSlot,
  createSelectionSlotPreview,
} from './character-sheet-selections-view-model';
import { calculateCharacterSheet } from '~/lib/character-sheet';
import type { CharacterSheetSnapshot } from './use-character-sheet';

function selectionSheet(
  prerequisites: NonNullable<
    CharacterSheetSnapshot['catalogEntries'][number]['prerequisites']
  > = [],
  legacy = false,
) {
  const snapshot = buildSheet();
  const catalog = {
    ...snapshot.baseScoresEntry,
    _id: 'feat-catalog' as typeof snapshot.baseScoresEntry._id,
    name: 'Weapon Focus',
    ruleIdentity: 'weapon-focus',
    modifiers: [],
    detail: {
      kind: 'feat' as const,
      featTypes: ['combat'],
      repeatable: 'newChoice' as const,
    },
    prerequisites,
    ...(legacy
      ? {
          proficiencyPrerequisites: [
            {
              kind: 'proficiency' as const,
              proficiency: { category: 'martial' as const },
            },
          ],
        }
      : {}),
  };
  const entry = {
    ...snapshot.entries[0]!,
    _id: 'feat-entry' as CharacterSheetSnapshot['entries'][number]['_id'],
    catalogEntryId: catalog._id,
    kind: 'feat' as const,
    active: true,
    state: {
      kind: 'feat' as const,
      choice: 'Longsword',
      slot: 'general' as const,
    },
    gainedAtClassLevel: snapshot.entries[1]!._id,
    choiceOrder: 0,
    selectionSlot: { id: 'feat:general', position: 0 },
  };
  const entries = [...snapshot.entries, entry];
  const catalogEntries = [...snapshot.catalogEntries, catalog];
  return {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
}

test('an unfilled first-Hit-Die feat slot and two trait slots expose their budgets without invented failures', () => {
  const view = buildCharacterSheetSelectionsView(buildSheet());
  expect(view.slots.find((slot) => slot.id === 'feat:general')).toMatchObject({
    count: 1,
    used: 0,
    remaining: 1,
  });
  expect(view.slots.find((slot) => slot.id === 'trait:general')).toMatchObject({
    count: 2,
    used: 0,
    remaining: 2,
  });
  expect(view.rows).toEqual([]);
});

test('unmodeled prose stays readable without displaying uncheckable rows or a failed picker status', () => {
  const snapshot = selectionSheet([
    { unchecked: 'Member of the local militia' },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.prerequisiteText).toBe('Member of the local militia');
  expect(row.currentStatus).toBeNull();
  expect(row.checks).toEqual([]);
  expect(row.warnings).toEqual([]);
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: row.entryId
      ? snapshot.catalogEntries.at(-1)!._id
      : snapshot.baseScoresEntry._id,
  });
  expect(preview).toMatchObject({
    currentStatus: null,
    checks: [],
    selectable: true,
    prerequisiteText: 'Member of the local militia',
  });
});

test('legacy proficiency prerequisites expose distinct current and recorded warnings and stay selectable', () => {
  const snapshot = selectionSheet([], true);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.currentStatus).toBe('unmet');
  expect(row.recordedStatus).toBe('unmet');
  expect(row.currentWarnings).toHaveLength(1);
  expect(row.recordedWarnings).toHaveLength(1);
  expect(row.checks).toHaveLength(2);
  expect(row.checks.filter((check) => check.view === 'current')).toHaveLength(
    1,
  );
  expect(row.checks.filter((check) => check.view === 'recorded')).toHaveLength(
    1,
  );
  expect(row.currentWarnings[0]!.subject).toBe('feat-entry:current:0');
  expect(row.recordedWarnings[0]!.subject).toBe('feat-entry:recorded:0');
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  });
  expect(preview).toMatchObject({
    currentStatus: 'unmet',
    recordedStatus: 'unmet',
    selectable: true,
  });
  expect(preview?.checks).toHaveLength(2);
  expect(
    preview?.checks.filter((check) => check.view === 'current'),
  ).toHaveLength(1);
  expect(
    preview?.checks.filter((check) => check.view === 'recorded'),
  ).toHaveLength(1);
});

test('a class feature requirement keeps its authored name when the original definition is unavailable', () => {
  const snapshot = selectionSheet([
    { classFeature: 'original-sneak-attack', classFeatureName: 'Sneak Attack' },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(row.checks.map((check) => check.label)).toEqual([
    'Sneak Attack',
    'Sneak Attack',
  ]);
  const preview = previewSelectionSlot(snapshot, {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  });
  expect(preview?.checks.map((check) => check.label)).toEqual([
    'Sneak Attack',
    'Sneak Attack',
  ]);
});

test('prerequisite row labels use the same canonical skill and ability labels as engine messages', () => {
  const snapshot = selectionSheet([
    { ability: 'strength', min: 13 },
    { bab: 1 },
    { skillRanks: 'per', min: 2 },
  ]);
  const row = buildCharacterSheetSelectionsView(snapshot).rows[0]!;
  expect(
    row.checks
      .filter((check) => check.view === 'current')
      .map((check) => check.label),
  ).toEqual(['Strength 13', 'BAB +1', 'Perception 2 ranks']);
});

test('drawback guidance is a separate field from prerequisite prose and descriptions stay available', () => {
  const snapshot = selectionSheet();
  const catalogEntries = snapshot.catalogEntries.map((entry) =>
    entry.ruleIdentity === 'weapon-focus'
      ? {
          ...entry,
          description: 'A narrative consequence.',
          guidanceText: 'Record consequences in notes.',
          detail: { kind: 'trait' as const, traitType: 'drawback' as const },
        }
      : entry,
  );
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'feat'
      ? {
          ...entry,
          kind: 'trait' as const,
          state: { kind: 'trait' as const, choice: null },
          selectionSlot: { id: 'trait:drawback', position: 0 },
        }
      : entry,
  );
  const updated = {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  const view = buildCharacterSheetSelectionsView(updated);
  expect(view.rows[0]).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
    description: 'A narrative consequence.',
  });
  expect(view.candidates[0]).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
  });
  expect(
    previewSelectionSlot(updated, {
      slotId: 'trait:drawback',
      position: 0,
      catalogEntryId: catalogEntries.at(-1)!._id,
    }),
  ).toMatchObject({
    prerequisiteText: '',
    guidanceText: 'Record consequences in notes.',
  });
});

test('picker previews reuse unchanged inputs and refresh when the saved sheet changes', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 13 }]);
  const input = {
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: snapshot.catalogEntries.at(-1)!._id,
  };
  const preview = createSelectionSlotPreview(snapshot);
  const first = preview(input);
  expect(first?.currentStatus).toBe('unmet');
  expect(preview({ ...input })).toBe(first);
  const strengthenedBase = buildSheet({
    scores: { ...snapshot.character, strength: 14 },
  });
  const strengthened = {
    ...snapshot,
    catalogEntries: snapshot.catalogEntries.map((catalog) =>
      catalog._id === snapshot.baseScoresEntry._id
        ? strengthenedBase.baseScoresEntry
        : catalog,
    ),
  };
  expect(createSelectionSlotPreview(strengthened)(input)?.currentStatus).toBe(
    'met',
  );
});

for (const order of [0, undefined]) {
  test(`replacement preview keeps ${order === undefined ? 'unknown' : 'tied'} recorded order before a later prerequisite feat`, () => {
    const snapshot = selectionSheet([{ feat: 'foundation' }]);
    const dependent = snapshot.entries.find((entry) => entry.kind === 'feat');
    const definition = snapshot.catalogEntries.at(-1);
    if (!dependent || !definition) throw new Error('Missing Selection');
    const foundationDefinition = {
      ...definition,
      _id: 'foundation-catalog' as typeof definition._id,
      ruleIdentity: 'foundation',
      name: 'Foundation',
      prerequisites: [],
    };
    const foundation = {
      ...dependent,
      _id: 'foundation-entry' as typeof dependent._id,
      catalogEntryId: foundationDefinition._id,
      choiceOrder: order,
      selectionSlot: { id: 'feat:general', position: 1 },
    };
    const entries = [
      ...snapshot.entries.map((entry) =>
        entry._id === dependent._id
          ? { ...dependent, choiceOrder: order }
          : entry,
      ),
      foundation,
    ];
    const catalogEntries = [...snapshot.catalogEntries, foundationDefinition];
    const updated = {
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    };
    expect(
      previewSelectionSlot(updated, {
        slotId: 'feat:general',
        position: 0,
        catalogEntryId: definition._id,
      }),
    ).toMatchObject({ currentStatus: 'met', recordedStatus: 'unmet' });
  });
}

for (const sourceKind of ['selectionSource', 'state.slot'] as const) {
  test(`a legacy bonus feat with ${sourceKind} reports its prerequisite exemption without slot placement metadata`, () => {
    const snapshot = selectionSheet([{ ability: 'strength', min: 99 }]);
    const base = snapshot.entries.find((entry) => entry.kind === 'base');
    const feat = snapshot.entries.find((entry) => entry.kind === 'feat');
    if (!base || !feat) throw new Error('Missing base or feat');
    const source = {
      kind: 'slot' as const,
      grantedBy: { kind: 'entry' as const, entryId: base._id },
      slotIndex: 0,
    };
    const { selectionSlot: _slot, ...legacy } = feat;
    const entries = snapshot.entries.map((entry) =>
      entry._id === feat._id
        ? {
            ...legacy,
            ...(sourceKind === 'selectionSource'
              ? { selectionSource: source }
              : { state: { ...feat.state, slot: source } }),
          }
        : entry,
    );
    const catalogEntries = snapshot.catalogEntries.map((definition) =>
      definition._id === base.catalogEntryId
        ? {
            ...definition,
            grantsSlots: [
              { kind: 'feat' as const, count: 1, ignoresPrerequisites: true },
            ],
          }
        : definition,
    );
    const updated = {
      ...snapshot,
      entries,
      catalogEntries,
      calculated: calculateCharacterSheet({
        entries,
        catalogEntries,
        characterKind: 'pc',
      }),
    };
    expect(buildCharacterSheetSelectionsView(updated).rows[0]).toMatchObject({
      currentStatus: 'exempt',
      recordedStatus: 'exempt',
      checks: [],
      currentWarnings: [],
      recordedWarnings: [],
    });
  });
}

type StructuredClassDefinition = Extract<
  CharacterSheetSnapshot['catalogEntries'][number],
  { detail: { kind: 'class'; hitDie: number } }
>;

function isStructuredClassDefinition(
  definition: CharacterSheetSnapshot['catalogEntries'][number],
): definition is StructuredClassDefinition {
  return (
    definition.detail.kind === 'class' &&
    'hitDie' in definition.detail &&
    typeof definition.detail.hitDie === 'number'
  );
}

test('a generated class feature bonus slot keeps its prerequisite exemption in the selection view', () => {
  const snapshot = selectionSheet([{ ability: 'strength', min: 99 }]);
  snapshot.catalogEntries = [
    ...snapshot.catalogEntries,
    ...buildSheet({ hasClasses: true }).catalogEntries.filter(
      (definition) => definition.detail.kind === 'class',
    ),
  ];
  const fighter = snapshot.catalogEntries.find(
    (definition) => definition.name === 'Fighter',
  );
  const wizard = snapshot.catalogEntries.find(
    (definition) => definition.name === 'Wizard',
  );
  const feat = snapshot.entries.find((entry) => entry.kind === 'feat');
  if (!fighter || !wizard || !feat)
    throw new Error('Missing fixture definitions');
  const catalogEntries = snapshot.catalogEntries.map((definition) =>
    definition._id === fighter._id && isStructuredClassDefinition(definition)
      ? {
          ...definition,
          detail: {
            ...definition.detail,
            featuresByLevel: [{ classLevel: 1, catalogEntryId: wizard._id }],
          },
        }
      : definition._id === wizard._id
        ? {
            ...definition,
            detail: { kind: 'classFeature' as const },
            grantsSlots: [
              { kind: 'feat' as const, count: 1, ignoresPrerequisites: true },
            ],
          }
        : definition,
  );
  const classEntries = snapshot.entries.map((entry) =>
    entry.kind === 'classLevel'
      ? { ...entry, state: { ...entry.state, classEntryId: fighter._id } }
      : entry,
  );
  const prepared = calculateCharacterSheet({
    entries: classEntries,
    catalogEntries,
    characterKind: 'pc',
  });
  const slot = prepared.selectionRules.slots.find(
    (slot) => slot.grantedBy?.kind === 'grant',
  );
  if (!slot || slot.grantedBy?.kind !== 'grant')
    throw new Error('Missing generated slot');
  const grantSource = slot.grantedBy;
  const entries = classEntries.map((entry) =>
    entry.kind === 'feat'
      ? {
          ...entry,
          selectionSlot: { id: slot.id, position: 0 },
          selectionSource: {
            kind: 'slot' as const,
            grantedBy: grantSource,
            slotIndex: 0,
          },
        }
      : entry,
  );
  const updated = {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  expect(entries.some((entry) => entry.kind === 'classFeature')).toBe(false);
  expect(buildCharacterSheetSelectionsView(updated).rows[0]).toMatchObject({
    currentStatus: 'exempt',
    recordedStatus: 'exempt',
    checks: [],
  });
});
