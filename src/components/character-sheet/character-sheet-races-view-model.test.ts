import { expect, test } from 'vitest';
import { calculateCharacterSheet } from '~/lib/character-sheet';
import { buildSheet } from './character-sheet-test-fixture';
import { buildCharacterSheetRacesView } from './character-sheet-races-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';

function fixture() {
  const snapshot = buildSheet({
    hasClasses: true,
    levels: [{ id: 'race-row', hp: null }],
    adjustments: [
      { id: 'heritage-row', name: 'Heritage', modifiers: [] },
      { id: 'standard-row', name: 'Standard', modifiers: [] },
    ],
  });
  const [base, original, copy, alternate, override, heritage, standard] =
    snapshot.catalogEntries;
  const raceRow = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  const heritageRow = snapshot.entries.find((entry) => entry.kind === 'manual');
  if (
    !base ||
    !original ||
    !copy ||
    !alternate ||
    !override ||
    !heritage ||
    !standard ||
    !raceRow ||
    !heritageRow
  )
    throw new Error('Missing fixture');
  const catalogEntries: CharacterSheetSnapshot['catalogEntries'] = [
    base,
    {
      ...original,
      name: 'Elf',
      ruleIdentity: 'elf',
      detail: { kind: 'race', racialTraits: [standard._id] },
    },
    {
      ...copy,
      name: 'Elf copy',
      ruleIdentity: 'elf',
      detail: { kind: 'race', racialTraits: [] },
    },
    {
      ...alternate,
      name: 'Subrace ability',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
        subrace: 'Illustrative subrace',
      },
    },
    {
      ...override,
      name: 'Subrace vision',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
        subrace: 'Illustrative subrace',
      },
    },
    {
      ...standard,
      name: 'Elf standard',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
      },
    },
    {
      ...heritage,
      name: 'Heritage',
      countsAsRaces: { oneOf: ['human', 'orc'] },
      detail: { kind: 'feat' },
    },
  ];
  const entries: CharacterSheetSnapshot['entries'] = [
    ...snapshot.entries.filter((entry) => entry.kind === 'base'),
    {
      ...raceRow,
      kind: 'race',
      catalogEntryId: copy._id,
      state: { kind: 'race' },
    },
    {
      ...heritageRow,
      kind: 'feat',
      catalogEntryId: heritage._id,
      state: { kind: 'feat', choice: 'human' },
    },
  ];
  return {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    ids: {
      alternate: alternate._id,
      override: override._id,
      heritage: heritage._id,
      copy: copy._id,
      standard: standard._id,
    },
  };
}

test('a Catalog Copy offers the original race’s independent subrace options without marking unselected options dormant', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(view.selectedRaceId).toBe(snapshot.ids.copy);
  expect(view.traitOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        catalogEntryId: snapshot.ids.alternate,
        subrace: 'Illustrative subrace',
        applicable: true,
        selected: false,
        dormant: false,
      }),
      expect.objectContaining({
        catalogEntryId: snapshot.ids.override,
        subrace: 'Illustrative subrace',
        applicable: true,
        selected: false,
        dormant: false,
      }),
    ]),
  );
});

test('race equivalence choices on a feat are available through its Selection target', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(view.choiceRows).toContainEqual({
    rowId: 'heritage-row',
    name: 'Heritage',
    target: { entryId: 'heritage-row' },
    counting: true,
    abilityScoreChoice: false,
    raceChoices: ['human', 'orc'],
    choice: 'human',
  });
});

test('the alternate picker excludes all known standards even when a Catalog Copy changes its standard list', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(
    view.traitOptions.some(
      (option) => option.catalogEntryId === snapshot.ids.standard,
    ),
  ).toBe(false);
});
