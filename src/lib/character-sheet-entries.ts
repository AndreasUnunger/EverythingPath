export const catalogSheetEntryKinds = [
  'spellEffect',
  'condition',
  'item',
  'spell',
] as const;
export type CatalogSheetEntryKind = (typeof catalogSheetEntryKinds)[number];
export const abilityChangeKinds = ['abilityDamage', 'abilityDrain'] as const;

/** Narrows the Catalog Entry kinds managed by the sheet entry editor. */
export function isCatalogSheetEntry<Entry extends { kind: string }>(
  entry: Entry | null | undefined,
): entry is Entry & { kind: CatalogSheetEntryKind } {
  return catalogSheetEntryKinds.some((kind) => kind === entry?.kind);
}

/** Narrows the entire definition, including its editable Modifier targets. */
export function isCatalogSheetDefinition<
  Entry extends { detail: { kind: string } },
>(
  entry: Entry | null | undefined,
): entry is Extract<Entry, { detail: { kind: CatalogSheetEntryKind } }> {
  return !!entry && isCatalogSheetEntry(entry.detail);
}

/** The catalog kinds that can be selected or supply a Grant. */
export const selectableCatalogSheetEntryKinds = [
  'manual',
  'race',
  'racialTrait',
  'archetype',
  'classFeature',
  'feat',
  'trait',
  ...catalogSheetEntryKinds,
] as const;
export type SelectableCatalogSheetEntryKind =
  (typeof selectableCatalogSheetEntryKinds)[number];

export function isSelectableCatalogSheetEntryKind(
  kind: string,
): kind is SelectableCatalogSheetEntryKind {
  return selectableCatalogSheetEntryKinds.some(
    (candidate) => candidate === kind,
  );
}

/** One kind-to-state mapping for new Selections and automatic Grants. */
export function createCatalogSheetEntryState(
  kind: SelectableCatalogSheetEntryKind,
  choice?: string | null,
  casterLevel = 1,
) {
  const chosen = choice === undefined ? {} : { choice };
  const entries = {
    manual: { kind: 'manual', state: { kind: 'manual', ...chosen } },
    race: { kind: 'race', state: { kind: 'race', ...chosen } },
    racialTrait: {
      kind: 'racialTrait',
      state: { kind: 'racialTrait', ...chosen },
    },
    archetype: { kind: 'archetype', state: { kind: 'archetype', ...chosen } },
    classFeature: {
      kind: 'classFeature',
      state: { kind: 'classFeature', ...chosen },
    },
    feat: { kind: 'feat', state: { kind: 'feat', ...chosen } },
    trait: { kind: 'trait', state: { kind: 'trait', ...chosen } },
    condition: { kind: 'condition', state: { kind: 'condition' } },
    item: { kind: 'item', state: { kind: 'item' } },
    spell: { kind: 'spell', state: { kind: 'spell' } },
    spellEffect: {
      kind: 'spellEffect',
      state: { kind: 'spellEffect', casterLevel },
    },
  } as const;
  return entries[kind];
}
