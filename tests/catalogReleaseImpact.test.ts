import { expect, test } from 'vitest';
import { planReleaseImpact } from '../src/lib/catalog/release-impact';
import { importedCatalogEntrySchema } from '../src/lib/catalog/imported-entry-schema';
import {
  calculateCharacterSheetForRelease,
  isSupportedCatalogCalculation,
} from '../src/lib/catalog/calculation-dispatch';
import {
  abilityKeys,
  abilityTargets,
  type CharacterSheetInput,
} from '../src/lib/character-sheet';

test('retains the landed default calculator identity and rejects the superseded pre-rebase identities', () => {
  const landedIdentity =
    'sha256:c34f3f686fc800ec766394a7a8fb747d317da5de31e4d00def22c25c6542e5c6';
  const supersededIdentities = [
    'sha256:cbdc087920f8f8027046422551e15dbb0151488bffd07ddc9375bead9021e539',
    'sha256:a0a094c701ddeb6123a372b6106ae32d22969bdf4a256c1bfaf2320c34d48bf0',
    'sha256:404dc533a4f5212248f8c8aa720de4115d85196b171e802d6d2cceff56aa9982',
    'sha256:10de1531a3f695d0eb5a42a632047548ca7f1afd4c8b59e48d9804ec940dbc07',
    'sha256:7a6006e58cfc1d2ed3c438033e53b82ef1d70cc9569449ecb6d6f00d8cc3f366',
    'sha256:65b39be01f2e0a0ab0abc5cf9c626b4344ed2e40f60fb1b4418ae7b9d509e6fd',
  ];
  const input: CharacterSheetInput = {
    characterKind: 'pc',
    entries: [
      {
        _id: 'base-row',
        kind: 'base',
        active: true,
        catalogEntryId: 'base',
        state: { kind: 'base' },
      },
    ],
    catalogEntries: [
      {
        _id: 'base',
        ruleIdentity: 'base',
        modifiers: abilityKeys.map((ability) => ({
          target: abilityTargets[ability],
          bonusType: 'base',
          value: 10,
        })),
      },
    ],
  };
  expect(isSupportedCatalogCalculation(landedIdentity)).toBe(true);
  expect(calculateCharacterSheetForRelease(landedIdentity, input).level).toBe(
    0,
  );
  for (const supersededIdentity of supersededIdentities) {
    expect(isSupportedCatalogCalculation(supersededIdentity)).toBe(false);
    expect(() =>
      calculateCharacterSheetForRelease(supersededIdentity, input),
    ).toThrow('Unavailable Catalog Release calculation behavior');
  }
});

test('imported definitions retain only the grant shapes emitted by the importer', () => {
  const entry = importedCatalogEntrySchema.parse({
    externalKey: 'pf1/Feature',
    upstreamKey: 'Feature',
    pack: 'feats',
    name: 'Feature',
    detail: { kind: 'manual' },
    description: '',
    sources: [],
    modifiers: [],
    unsupported: [],
    grants: [{ externalKey: 'pf1/UnemittedGrant' }],
  });
  expect(entry).not.toHaveProperty('grants');
});

test.each([
  {
    name: 'old relationship removed',
    roots: ['class'],
    old: [{ from: 'class', to: 'feat' }],
    next: [],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'new Grant relationship',
    roots: ['class'],
    old: [],
    next: [{ from: 'class', to: 'feat' }],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'copy retains a global reference',
    roots: ['copy'],
    old: [{ from: 'copy', to: 'feat' }],
    next: [],
    changed: ['feat'],
    isAffected: true,
  },
  {
    name: 'copiedFrom is provenance only',
    roots: ['copy'],
    old: [],
    next: [],
    changed: ['original'],
    isAffected: false,
  },
  {
    name: 'keyed spell relationship',
    roots: ['grant'],
    old: [],
    next: [{ from: 'grant', to: 'key:spell' }],
    changed: ['key:spell'],
    isAffected: true,
  },
  {
    name: 'shared rule resource',
    roots: ['resource:casting'],
    old: [],
    next: [],
    changed: ['resource:casting'],
    isAffected: true,
  },
  {
    name: 'unrelated notice',
    roots: ['class'],
    old: [],
    next: [],
    changed: ['legal:notices'],
    isAffected: false,
  },
])('$name', ({ roots, old, next, changed, isAffected }) => {
  expect(
    planReleaseImpact({
      roots,
      oldEdges: old,
      newEdges: next,
      changed,
      hasCalculationChanged: false,
    }).isAffected,
  ).toBe(isAffected);
});

test('a resolver-only release includes every sheet without graph changes', () => {
  expect(
    planReleaseImpact({
      roots: [],
      oldEdges: [],
      newEdges: [],
      changed: [],
      hasCalculationChanged: true,
    }),
  ).toEqual({ isAffected: true, reasons: ['calculation'] });
});
