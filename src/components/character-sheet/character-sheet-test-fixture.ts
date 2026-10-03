import type { Id } from '@convex/_generated/dataModel';
import {
  abilityKeys,
  abilityTargets,
  calculateCharacterSheet,
  defaultAbilityScores,
  type Ability,
  type AbilityScores,
  type FavoredClassBonus,
  type Modifier,
  type SheetWarning,
} from '~/lib/character-sheet';
import { representativeClassCatalog } from '../../../tests/fixtures/catalog/representative-class-progressions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// A read snapshot for the living sheet's component tests: base scores, Class
// Levels with their choices, the representative classes, personal
// adjustments and accepted warnings, calculated by the public resolver.

export const characterId = 'character-1' as Id<'character'>;
// The campaign row calls the owner-candidate hook even while its picker is
// closed. Tests of other sheet controls keep that skipped query empty.
export function emptyOwnerCandidates() {
  return {
    results: [],
    status: 'Exhausted' as const,
    loadMore: () => undefined,
  };
}

export type ClassKey = (typeof representativeClassCatalog)[number]['_id'];
export type Level = {
  id: string;
  hp: number | null;
  classId?: ClassKey | null;
  favoredClassBonus?: FavoredClassBonus | null;
  abilityIncrease?: Ability | null;
  skillRanks?: Record<string, number>;
  proficiencyChoice?: string | null;
};
export type Adjustment = {
  id: string;
  name: string;
  active?: boolean;
  modifiers: Modifier[];
  /** The Class Level this selection was gained at, which may be gone. */
  gainedAtClassLevel?: string;
};
export type AbilityChange = {
  id: string;
  kind: 'abilityDamage' | 'abilityDrain';
  ability: Ability;
  points: number;
  active?: boolean;
};
type Entry = CharacterSheetSnapshot['entries'][number];
type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
export type SheetEntryDetail = Extract<
  CatalogEntry['detail'],
  { kind: 'spellEffect' | 'condition' | 'item' | 'spell' }
>;
export type CatalogSheetEntry = {
  id: string;
  name: string;
  detail: SheetEntryDetail;
  modifiers: Modifier[];
  /** A Spell Effect's recorded caster level; the default when absent. */
  casterLevel?: number;
  active?: boolean;
};
export type Accepted = Pick<SheetWarning, 'check' | 'subject' | 'fingerprint'>;

function entryState(entry: CatalogSheetEntry) {
  if (entry.detail.kind !== 'spellEffect') return { kind: entry.detail.kind };
  return {
    kind: 'spellEffect',
    casterLevel: entry.casterLevel ?? entry.detail.defaultCasterLevel,
  };
}

/** The calculated warning for one check, to accept it as the sheet states it. */
export function findCalculatedWarning(
  snapshot: CharacterSheetSnapshot,
  check: SheetWarning['check'],
  subject?: string,
) {
  const warning = snapshot.calculated.warnings.find(
    (candidate) =>
      candidate.check === check &&
      (subject === undefined || candidate.subject === subject),
  );
  if (!warning) throw new Error(`Expected a ${check} warning`);
  return warning;
}

export function buildSheet({
  scores = defaultAbilityScores,
  levels = [{ id: 'level-1', hp: null }],
  adjustments = [],
  abilityChanges = [],
  sheetEntries = [],
  hasClasses = levels.some((level) => level.classId),
  favoredClassIds = [],
  accepted = [],
  lastOperationId = 'seed',
  name = 'Kesh',
}: {
  scores?: AbilityScores;
  levels?: Level[];
  adjustments?: Adjustment[];
  abilityChanges?: AbilityChange[];
  sheetEntries?: CatalogSheetEntry[];
  hasClasses?: boolean;
  favoredClassIds?: ClassKey[];
  accepted?: Accepted[];
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
  const classCatalogs = hasClasses
    ? representativeClassCatalog.map(
        (entry) =>
          ({
            ...entry,
            _creationTime: 3,
            scope: 'character',
            characterId,
            stacksWithItself: false,
            sources: [],
          }) as unknown as CatalogEntry,
      )
    : [];
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
  const entryCatalogs = sheetEntries.map(
    (entry) =>
      ({
        _id: `${entry.id}-catalog` as Id<'catalogEntry'>,
        _creationTime: 6,
        scope: 'character',
        characterId,
        name: entry.name,
        ruleIdentity: `entry:${entry.id}`,
        stacksWithItself: false,
        detail: entry.detail,
        sources: [],
        modifiers: entry.modifiers,
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
      state: {
        kind: 'base',
        ...(favoredClassIds.length > 0 ? { favoredClassIds } : {}),
      },
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
            classEntryId: level.classId ?? null,
            ...(level.skillRanks !== undefined
              ? { skillRanks: level.skillRanks }
              : {}),
            ...(level.proficiencyChoice !== undefined
              ? { proficiencyChoice: level.proficiencyChoice }
              : {}),
            position: index + 1,
            hpGained: level.hp,
            ...(level.favoredClassBonus !== undefined
              ? { favoredClassBonus: level.favoredClassBonus }
              : {}),
            ...(level.abilityIncrease !== undefined
              ? { abilityIncrease: level.abilityIncrease }
              : {}),
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
          ...(adjustment.gainedAtClassLevel
            ? { gainedAtClassLevel: adjustment.gainedAtClassLevel }
            : {}),
        }) as Entry,
    ),
    ...abilityChanges.map(
      (change, index) =>
        ({
          _id: change.id as Id<'characterSheetEntry'>,
          _creationTime: 20 + index,
          characterId,
          kind: change.kind,
          active: change.active ?? true,
          state: {
            kind: change.kind,
            ability: change.ability,
            points: change.points,
          },
        }) as Entry,
    ),
    ...sheetEntries.map(
      (entry, index) =>
        ({
          _id: entry.id as Id<'characterSheetEntry'>,
          _creationTime: 30 + index,
          characterId,
          kind: entry.detail.kind,
          active: entry.active ?? true,
          catalogEntryId: `${entry.id}-catalog` as Id<'catalogEntry'>,
          state: entryState(entry),
        }) as Entry,
    ),
  ];
  const catalogEntries = [
    baseCatalog,
    ...classCatalogs,
    ...adjustmentCatalogs,
    ...entryCatalogs,
  ];
  return {
    owner: null,
    campaign: {
      campaignId,
      campaignName: 'Ironfang',
      organizationId: 'org',
      ownershipAvailable: true,
    },
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
    permanentCalculated: calculateCharacterSheet(
      {
        entries,
        catalogEntries,
        characterKind: 'pc',
      },
      { permanentOnly: true },
    ),
    acceptedWarnings: accepted.map((warning, index) => ({
      _id: `accepted-${index}` as Id<'acceptedWarning'>,
      _creationTime: 10 + index,
      characterId,
      acceptedBy: 'other-player',
      acceptedAt: 10 + index,
      ...warning,
    })),
    revision: 1,
    lastOperationId,
    updatedBy: 'owner',
  };
}
