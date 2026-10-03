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
