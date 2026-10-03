import type { Id } from '@convex/_generated/dataModel';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  defaultAbilityScores,
  type AbilityScores,
  type Modifier,
} from '~/lib/character-sheet';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// A read snapshot for the living sheet's component tests: base scores, Class
// Levels and personal adjustments, calculated by the public resolver.

export const characterId = 'character-1' as Id<'character'>;
export type Level = { id: string; hp: number | null };
export type Adjustment = {
  id: string;
  name: string;
  active?: boolean;
  modifiers: Modifier[];
};
type Entry = CharacterSheetSnapshot['entries'][number];
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];

export function buildSheet({
  scores = defaultAbilityScores,
  levels = [{ id: 'level-1', hp: null }],
  adjustments = [],
  lastOperationId = 'seed',
  name = 'Kesh',
}: {
  scores?: AbilityScores;
  levels?: Level[];
  adjustments?: Adjustment[];
  lastOperationId?: string;
  name?: string;
} = {}): CharacterSheetSnapshot {
  const campaignId = 'campaign-1' as Id<'campaign'>;
  const baseCatalog: CharacterSheetSnapshot['baseScoresEntry'] = {
    _id: 'base-catalogEntry' as Id<'catalogEntry'>,
    _creationTime: 1,
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: 'base',
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base' as const,
      value: scores[ability],
    })),
  };
  const adjustmentCatalogs = adjustments.map(
    (adjustment) =>
      ({
        _id: `${adjustment.id}-catalog` as Id<'catalogEntry'>,
        _creationTime: 5,
        scope: 'character',
        characterId,
        name: adjustment.name,
        ruleIdentity: `manual:${adjustment.id}`,
        stacksWithItself: false,
        detail: { kind: 'manual' },
        sources: [],
        modifiers: adjustment.modifiers,
      }) as unknown as CatalogEntry,
  );
  const entries: Entry[] = [
    {
      _id: 'base-entry' as Id<'characterSheetEntry'>,
      _creationTime: 1,
      characterId,
      kind: 'base',
      active: true,
      catalogEntryId: baseCatalog._id,
      state: { kind: 'base' },
    } as Entry,
    ...levels.map(
      (level, index) =>
        ({
          _id: level.id as Id<'characterSheetEntry'>,
          _creationTime: 2 + index,
          characterId,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: null,
            position: index + 1,
            hpGained: level.hp,
          },
        }) as Entry,
    ),
    ...adjustments.map(
      (adjustment, index) =>
        ({
          _id: adjustment.id as Id<'characterSheetEntry'>,
          _creationTime: 10 + index,
          characterId,
          kind: 'manual',
          active: adjustment.active ?? true,
          catalogEntryId: `${adjustment.id}-catalog` as Id<'catalogEntry'>,
          state: { kind: 'manual' },
        }) as Entry,
    ),
  ];
  const catalogEntries = [baseCatalog, ...adjustmentCatalogs];
  return {
    campaign: { campaignId, campaignName: 'Ironfang', organizationId: 'org' },
    character: {
      _id: characterId,
      _creationTime: 1,
      campaignId,
      name,
      description: 'Rides with the militia.',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      sheetMode: 'full',
      level: 1,
      ...defaultAbilityScores,
    },
    entries,
    catalogEntries,
    baseScoresEntry: baseCatalog,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    acceptedWarnings: [],
    revision: 1,
    lastOperationId,
    updatedBy: 'owner',
  };
}
