import { expect, test } from 'vitest';
import {
  listCatalogReferences,
  remapCatalogReferences,
} from './catalog-copy-references';

test('slot feat definitions participate in discovery and remapping while prerequisite rule identities stay durable', () => {
  const originalId = 'catalog-original';
  const definition = {
    grantsSlots: [{ kind: 'feat', count: 1, feats: [originalId] }],
    prerequisites: [
      { feat: originalId },
      { classFeature: originalId },
      { racialTrait: originalId },
      { classLevel: originalId, min: 1 },
      { race: [originalId] },
    ],
    ruleIdentity: originalId,
    copiedFrom: originalId,
  };
  expect(listCatalogReferences(definition)).toEqual([
    { id: originalId, kind: 'definition' },
  ]);
  expect(
    remapCatalogReferences(definition, originalId, 'catalog-copy'),
  ).toEqual({
    ...definition,
    grantsSlots: [{ kind: 'feat', count: 1, feats: ['catalog-copy'] }],
  });
  expect(definition.grantsSlots.at(0)?.feats).toEqual([originalId]);
});

test('selection slot metadata retains sheet IDs and grant rule identities during catalog remapping', () => {
  const selection = {
    catalogEntryId: 'original',
    gainedAtClassLevel: 'original',
    selectionSlot: { id: 'original', position: 0 },
    selectionSource: {
      kind: 'slot',
      grantedBy: {
        kind: 'grant',
        grantKey: { source: 'original', entry: 'original', classLevel: 1 },
      },
      slotIndex: 0,
    },
  };
  expect(listCatalogReferences(selection)).toEqual([
    { id: 'original', kind: 'definition' },
  ]);
  expect(remapCatalogReferences(selection, 'original', 'copy')).toEqual({
    ...selection,
    catalogEntryId: 'copy',
  });
});
