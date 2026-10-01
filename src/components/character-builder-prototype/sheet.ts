// PROTOTYPE (throwaway, #208) — pure read helpers over one Character's sheet.

import {
  CAMPAIGN_CATALOG_BY_KEY,
  CATALOG_BY_KEY,
  POINT_BUY_COST,
  catalogForGroup,
  classDetail,
} from './catalog';
import {
  ABILITIES,
  type AbilityKey,
  type CatalogEntry,
  type Character,
  type ClassLevelState,
  type FeatureGrant,
  type SheetEntry,
} from './types';

export type ClassLevelEntry = SheetEntry & { state: ClassLevelState };

/** A catalog entry by key: the character's own scope first, then global. */
export function lookupCatalog(
  character: Character,
  key: string | undefined,
): CatalogEntry | undefined {
  if (!key) return undefined;
  return (
    character.ownCatalog.find((entry) => entry.key === key) ??
    CATALOG_BY_KEY[key] ??
    CAMPAIGN_CATALOG_BY_KEY[key]
  );
}

/** Class Levels in the order taken (position 1…n). */
export function classLevels(character: Character): ClassLevelEntry[] {
  return character.entries
    .filter((e): e is ClassLevelEntry => e.state.kind === 'classLevel')
    .sort((a, b) => a.state.position - b.state.position);
}

export function characterLevel(character: Character) {
  return classLevels(character).length;
}

/**
 * One line for lists: "Level 7 · Barbarian 4 / Rogue 3", or "Level 5" when
 * no level has a class (a Militia-only sheet, or one with only Unspecified levels).
 */
export function levelLine(character: Character) {
  const levels = classLevels(character);
  const counts = new Map<string, number>();
  for (const l of levels)
    if (l.state.classKey)
      counts.set(
        className(l.state.classKey),
        (counts.get(className(l.state.classKey)) ?? 0) + 1,
      );
  const classes = [...counts].map(([n, c]) => `${n} ${c}`).join(' / ');
  return classes
    ? `Level ${levels.length} · ${classes}`
    : `Level ${levels.length}`;
}

export function findClassLevel(character: Character, levelId: string) {
  return classLevels(character).find((l) => l.id === levelId);
}

/** The level within its class: count of earlier-or-equal levels of the same class. */
export function levelInClass(character: Character, levelId: string) {
  const levels = classLevels(character);
  const level = levels.find((l) => l.id === levelId);
  if (!level?.state.classKey) return 0;
  return levels.filter(
    (l) =>
      l.state.classKey === level.state.classKey &&
      l.state.position <= level.state.position,
  ).length;
}

export function className(classKey: string | null) {
  if (!classKey) return 'Unspecified';
  return CATALOG_BY_KEY[classKey]?.name ?? classKey;
}

/** "Rogue 4 · character level 8", or "Unspecified · character level 3". */
export function classLevelLabel(character: Character, levelId: string) {
  const level = findClassLevel(character, levelId);
  if (!level) return 'Removed level';
  const { classKey, position } = level.state;
  const head = classKey
    ? `${className(classKey)} ${levelInClass(character, levelId)}`
    : 'Unspecified';
  return `${head} · character level ${position}`;
}

/** "Rogue 4" without the character level. */
export function classLevelShortLabel(character: Character, levelId: string) {
  const level = findClassLevel(character, levelId);
  if (!level) return 'Removed level';
  return level.state.classKey
    ? `${className(level.state.classKey)} ${levelInClass(character, levelId)}`
    : 'Unspecified';
}

export function baseEntry(character: Character): CatalogEntry | undefined {
  return character.ownCatalog.find((e) => e.detail.kind === 'base');
}

/** Base ability scores from the character-scoped `base` Catalog Entry. */
export function baseScores(character: Character): Record<AbilityKey, number> {
  const entry = baseEntry(character);
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  for (const mod of entry?.modifiers ?? []) {
    const ability = mod.target.replace('ability.', '') as AbilityKey;
    if (ABILITIES.includes(ability) && typeof mod.value === 'number')
      scores[ability] = mod.value;
  }
  return scores;
}

export function raceSheetEntry(character: Character) {
  return character.entries.find((e) => e.kind === 'race');
}

export function raceCatalog(character: Character) {
  const entry = raceSheetEntry(character);
  const catalog = lookupCatalog(character, entry?.catalogKey);
  return catalog?.detail.kind === 'race'
    ? { entry: entry!, catalog, detail: catalog.detail }
    : null;
}

export function favoredClass(character: Character): string | null {
  const entry = raceSheetEntry(character);
  return entry?.state.kind === 'race' ? entry.state.favoredClass : null;
}

export function racialHitDice(character: Character) {
  return raceCatalog(character)?.detail.racialHitDice ?? 0;
}

export function hitDice(character: Character) {
  return characterLevel(character) + racialHitDice(character);
}

/** Temporary Effects: short spells, conditions, consumables, ability damage. */
export function isTemporary(character: Character, entry: SheetEntry) {
  if (entry.kind === 'abilityDamage' || entry.kind === 'condition') return true;
  const detail = lookupCatalog(character, entry.catalogKey)?.detail;
  if (detail?.kind === 'spell') return !detail.lastsOverOneDay;
  if (detail?.kind === 'item') return detail.consumable;
  return false;
}

export function entriesOfKind(character: Character, kind: SheetEntry['kind']) {
  return character.entries.filter((e) => e.kind === kind);
}

export function entryName(character: Character, entry: SheetEntry) {
  if (entry.state.kind === 'classLevel')
    return classLevelLabel(character, entry.id);
  if (
    entry.state.kind === 'abilityDamage' ||
    entry.state.kind === 'abilityDrain'
  )
    return `${entry.state.kind === 'abilityDamage' ? 'Ability damage' : 'Ability drain'} (${entry.state.ability} ${entry.state.points})`;
  const catalog = lookupCatalog(character, entry.catalogKey);
  const name = catalog?.name ?? entry.catalogKey ?? entry.kind;
  if ('choice' in entry.state && entry.state.choice)
    return `${name} (${entry.state.choice})`;
  return name;
}

/** Point-buy cost of a set of scores; null for a score outside 7–18. */
export function pointBuyCost(scores: Record<AbilityKey, number>) {
  let total = 0;
  const outOfRange: AbilityKey[] = [];
  for (const ability of ABILITIES) {
    const cost = POINT_BUY_COST[scores[ability]];
    if (cost === undefined) outOfRange.push(ability);
    else total += cost;
  }
  return { total, outOfRange };
}

/**
 * Skill ranks a Class Level allows: class ranks + Int modifier (min 1) +
 * racial bonus + 1 for a skill favored class bonus. Int counts permanent
 * entries only (base, race, ability increases up to this level, permanent
 * items), per the data model's Temporary Effects rule.
 */
export function skillRankBudgetWithInt(
  character: Character,
  levelId: string,
  permanentInt: number,
) {
  const level = findClassLevel(character, levelId);
  const detail = classDetail(level?.state.classKey ?? null);
  if (!level || !detail) return null;
  const intMod = Math.floor((permanentInt - 10) / 2);
  const racial = raceCatalog(character)?.detail.bonusSkillRanksPerLevel ?? 0;
  const fcb = level.state.favoredClassBonus?.choice === 'skill' ? 1 : 0;
  const base = Math.max(1, detail.skillRanksPerLevel + intMod);
  return {
    total: base + racial + fcb,
    parts: [
      {
        label: `${className(level.state.classKey)} ranks`,
        value: detail.skillRanksPerLevel,
      },
      { label: 'Int modifier', value: intMod },
      ...(racial ? [{ label: 'Racial (skilled)', value: racial }] : []),
      ...(fcb ? [{ label: 'Favored class bonus', value: fcb }] : []),
    ],
    spent: Object.values(level.state.skillRanks).reduce(
      (a, b) => a + (b ?? 0),
      0,
    ),
  };
}

export type FeatSlot = {
  kind: 'general' | 'racial' | 'class';
  reason: string;
  classLevelId: string | null;
};

/** Feat slots: every odd character level, the human bonus feat, class bonus feats. */
export function featSlots(character: Character) {
  const levels = classLevels(character);
  const slots: FeatSlot[] = [];
  for (const level of levels) {
    if (level.state.position % 2 === 1)
      slots.push({
        kind: 'general',
        reason: `Character level ${level.state.position}`,
        classLevelId: level.id,
      });
  }
  const race = raceCatalog(character);
  if (race?.detail.bonusFeat && levels[0])
    slots.push({
      kind: 'racial',
      reason: `${race.catalog.name} bonus feat`,
      classLevelId: levels[0].id,
    });
  for (const level of levels) {
    for (const grant of grantsAt(character, level.id)) {
      if ('choose' in grant && grant.choose === 'combatFeat')
        slots.push({
          kind: 'class',
          reason: `${classLevelShortLabel(character, level.id)}: ${grant.label}`,
          classLevelId: level.id,
        });
    }
  }
  // Feats a class grants outright (wizard's Scribe Scroll) use no slot.
  const taken = character.entries.filter(
    (e) =>
      e.kind === 'feat' &&
      !(
        e.gainedAtClassLevel &&
        grantsAt(character, e.gainedAtClassLevel).some(
          (g) => 'catalogKey' in g && g.catalogKey === e.catalogKey,
        )
      ),
  );
  return { slots, taken: taken.length };
}

/** The class's FeatureGrants for one Class Level (by its level within the class). */
export function grantsAt(
  character: Character,
  levelId: string,
): FeatureGrant[] {
  const level = findClassLevel(character, levelId);
  const detail = classDetail(level?.state.classKey ?? null);
  if (!level || !detail) return [];
  const n = levelInClass(character, levelId);
  return detail.featuresByLevel.filter((g) => g.classLevel === n);
}

export type GainedFeature =
  | {
      kind: 'fixed';
      grant: Extract<FeatureGrant, { catalogKey: string }>;
      catalog: CatalogEntry | undefined;
      /** The sheet entry gained at this level, if present. */
      entry: SheetEntry | undefined;
    }
  | {
      kind: 'choice';
      grant: Extract<FeatureGrant, { choose: string }>;
      options: CatalogEntry[];
      /** Entries gained at this level that fill the pick. */
      picked: SheetEntry[];
    };

/**
 * What a Class Level grants and whether it is on the sheet: fixed features,
 * picks (rage power, rogue talent, bonus feat), the general feat slot and
 * the ability increase due at character levels 4, 8, 12…
 */
export function featuresGainedAt(character: Character, levelId: string) {
  const level = findClassLevel(character, levelId);
  const gainedHere = character.entries.filter(
    (e) => e.gainedAtClassLevel === levelId,
  );
  const features: GainedFeature[] = grantsAt(character, levelId).map(
    (grant) => {
      if ('catalogKey' in grant)
        return {
          kind: 'fixed',
          grant,
          catalog: lookupCatalog(character, grant.catalogKey),
          entry: gainedHere.find((e) => e.catalogKey === grant.catalogKey),
        };
      const options = catalogForGroup(grant.choose);
      return {
        kind: 'choice',
        grant,
        options,
        picked: gainedHere.filter((e) =>
          options.some((o) => o.key === e.catalogKey),
        ),
      };
    },
  );
  const position = level?.state.position ?? 0;
  return {
    features,
    generalFeat: position % 2 === 1,
    abilityIncreaseDue: position > 0 && position % 4 === 0,
    gainedHere,
  };
}

/** Labels of real (class-specified) levels that lowering to `level` would remove. */
export function levelsRemovedBy(character: Character, level: number) {
  return classLevels(character)
    .filter((l) => l.state.position > level && l.state.classKey !== null)
    .map((l) => classLevelLabel(character, l.id));
}
