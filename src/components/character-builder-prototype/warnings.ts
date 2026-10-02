// PROTOTYPE (throwaway, #208) — advisory rules checks. They never block:
// every state they describe can still be saved and kept (AGENTS.md
// "Validation Philosophy").

import { ABILITY_SHORT, SKILL_BY_KEY, classDetail } from './catalog';
import { resolveSheet } from './resolve';
import { spellWarnings } from './spellcasting';
import {
  baseScores,
  classLevelLabel,
  classLevels,
  entryName,
  favoredClass,
  featSlots,
  featuresGainedAt,
  lookupCatalog,
  pointBuyCost,
  raceSheetEntry,
  skillRankBudgetWithInt,
} from './sheet';
import type { Character, ResolvedSheet, SkillKey } from './types';

export type Warning = {
  id: string;
  /** warning: a rules mismatch; prompt: a suggested next step; info: something not recorded yet. */
  severity: 'warning' | 'prompt' | 'info';
  /**
   * Where it belongs: 'abilities' | 'race' | 'level' | 'skills' | 'feats' |
   * 'features' | 'sheet' | `classLevel:<levelId>` | `entry:<entryId>` |
   * `spellcasting:<classKey>` (#233).
   */
  where: string;
  message: string;
  /**
   * PROTOTYPE (#233): a spell rules check the player may accept as intended
   * (Accepted Warnings). `fingerprint` is the facts that raised it: when they
   * change, an acceptance no longer covers it.
   */
  acceptable?: boolean;
  fingerprint?: string;
  /** PROTOTYPE (#233): the spell level a Spellcasting warning is about. */
  spellLevel?: number;
  /** An optional one-click fix the UI may offer (never applied automatically). */
  action?: {
    kind: 'addEntry';
    label: string;
    catalogKey: string;
    gainedAtClassLevel?: string;
  };
};

export type WarningOptions = { pointBuyBudget?: number };

/**
 * Advisory warnings for one Character. Militia-only Characters get only the
 * checks that matter to that presentation (level 0 PC); everything about
 * building out the sheet waits until it is a Full Character.
 */
export function advisoryWarnings(
  character: Character,
  opts: WarningOptions = {},
): Warning[] {
  const budget = opts.pointBuyBudget ?? 20;
  const out: Warning[] = [];
  const levels = classLevels(character);
  const full = character.sheetMode === 'full';

  if (character.kind === 'pc' && levels.length === 0)
    out.push({
      id: 'level-zero',
      severity: 'warning',
      where: 'level',
      message: 'A player character at level 0 — add a Class Level.',
    });
  if (!full) return out;

  const permanent = resolveSheet(character, { permanentOnly: true });

  // Abilities: point buy.
  const cost = pointBuyCost(baseScores(character));
  if (cost.outOfRange.length > 0)
    out.push({
      id: 'pointbuy-range',
      severity: 'warning',
      where: 'abilities',
      message: `Base ${cost.outOfRange.map((a) => ABILITY_SHORT[a]).join(', ')} outside point buy’s 7–18.`,
    });
  else if (cost.total !== budget)
    out.push({
      id: 'pointbuy-budget',
      severity: 'warning',
      where: 'abilities',
      message: `Point buy spends ${cost.total} of ${budget} points (${cost.total > budget ? `${cost.total - budget} over` : `${budget - cost.total} left`}).`,
    });

  // Race and favored class.
  const race = raceSheetEntry(character);
  const raceCatalog = lookupCatalog(character, race?.catalogKey);
  if (!race)
    out.push({
      id: 'race-missing',
      severity: 'info',
      where: 'race',
      message: 'No race recorded.',
    });
  else if (
    race.state.kind === 'race' &&
    raceCatalog?.detail.kind === 'race' &&
    raceCatalog.detail.chooseAbility &&
    !race.state.abilityChoice
  )
    out.push({
      id: 'race-choice',
      severity: 'info',
      where: 'race',
      message: `${raceCatalog.name}: choose the ability that gets +2.`,
    });
  const favored = favoredClass(character);
  if (race && !favored && levels.some((l) => l.state.classKey))
    out.push({
      id: 'favored-missing',
      severity: 'info',
      where: 'race',
      message: 'No favored class chosen.',
    });

  // Class Levels.
  for (const level of levels) {
    const where = `classLevel:${level.id}`;
    const label = classLevelLabel(character, level.id);
    const { classKey, position, abilityIncrease, favoredClassBonus, hpGained } =
      level.state;
    if (classKey === null) {
      out.push({
        id: `${level.id}-unspecified`,
        severity: 'info',
        where,
        message: `Character level ${position} has no class yet; it adds only a Hit Die.`,
      });
      continue;
    }
    if (hpGained === null)
      out.push({
        id: `${level.id}-hp`,
        severity: 'info',
        where,
        message: `${label}: hit points not recorded.`,
      });
    else if (
      hpGained > (classDetail(classKey)?.hitDie ?? Infinity) ||
      hpGained < 1
    )
      out.push({
        id: `${level.id}-hp-range`,
        severity: 'warning',
        where,
        message: `${label}: ${hpGained} hp is outside 1–${classDetail(classKey)?.hitDie}.`,
      });
    const due = position % 4 === 0;
    if (abilityIncrease && !due)
      out.push({
        id: `${level.id}-increase-off`,
        severity: 'warning',
        where,
        message: `${label}: ability increases come at levels 4, 8, 12, 16 and 20.`,
      });
    if (!abilityIncrease && due)
      out.push({
        id: `${level.id}-increase-missing`,
        severity: 'prompt',
        where,
        message: `${label}: choose an ability score increase.`,
      });
    if (favoredClassBonus && favored && classKey !== favored)
      out.push({
        id: `${level.id}-fcb`,
        severity: 'warning',
        where,
        message: `${label}: favored class bonus on a class that isn’t favored.`,
      });
    if (!favoredClassBonus && favored && classKey === favored)
      out.push({
        id: `${level.id}-fcb-missing`,
        severity: 'info',
        where,
        message: `${label}: favored class bonus not chosen.`,
      });
    const rankBudget = skillRankBudgetWithInt(
      character,
      level.id,
      permanent.abilities.int.total,
    );
    if (rankBudget && rankBudget.spent > rankBudget.total)
      out.push({
        id: `${level.id}-ranks-over`,
        severity: 'warning',
        where,
        message: `${label}: ${rankBudget.spent} skill ranks spent of ${rankBudget.total}.`,
      });
    else if (rankBudget && rankBudget.spent < rankBudget.total)
      out.push({
        id: `${level.id}-ranks-left`,
        severity: 'info',
        where,
        message: `${label}: ${rankBudget.total - rankBudget.spent} skill rank${rankBudget.total - rankBudget.spent === 1 ? '' : 's'} left to spend.`,
      });
    const gained = featuresGainedAt(character, level.id);
    for (const feature of gained.features) {
      if (feature.kind === 'fixed' && !feature.entry)
        out.push({
          id: `${level.id}-missing-${feature.grant.catalogKey}`,
          severity: 'prompt',
          where,
          message: `${label} grants ${feature.catalog?.name ?? feature.grant.catalogKey}.`,
          action: {
            kind: 'addEntry',
            label: `Add ${feature.catalog?.name ?? feature.grant.catalogKey}`,
            catalogKey: feature.grant.catalogKey,
            gainedAtClassLevel: level.id,
          },
        });
      if (
        feature.kind === 'choice' &&
        feature.picked.length < (feature.grant.count ?? 1)
      )
        out.push({
          id: `${level.id}-pick-${feature.grant.choose}`,
          severity: 'prompt',
          where,
          message:
            (feature.grant.count ?? 1) > 1
              ? `${label}: choose ${(feature.grant.count ?? 1) - feature.picked.length} more ${feature.grant.label.toLowerCase()}${(feature.grant.count ?? 1) - feature.picked.length === 1 ? '' : 's'}.`
              : `${label}: choose a ${feature.grant.label.toLowerCase()}.`,
        });
    }
  }

  // Skills: ranks in one skill above Hit Dice.
  for (const [key, stat] of Object.entries(permanent.skills) as [
    SkillKey,
    ResolvedSheet['skills'][SkillKey],
  ][])
    if (stat.ranks > permanent.hitDice)
      out.push({
        id: `skill-${key}-over-hd`,
        severity: 'warning',
        where: 'skills',
        message: `${SKILL_BY_KEY[key].name}: ${stat.ranks} ranks, more than ${permanent.hitDice} Hit Dice.`,
      });

  // Feats: prerequisites and slots.
  const hasCatalog = (key: string) =>
    character.entries.some((e) => e.catalogKey === key && e.active);
  for (const entry of character.entries) {
    const catalog = lookupCatalog(character, entry.catalogKey);
    if (entry.kind !== 'feat' || catalog?.detail.kind !== 'feat') continue;
    const unmet: string[] = [];
    for (const p of catalog.detail.prerequisites) {
      if (p.kind === 'ability' && permanent.abilities[p.ability].total < p.min)
        unmet.push(`${ABILITY_SHORT[p.ability]} ${p.min}`);
      if (p.kind === 'bab' && permanent.bab.total < p.min)
        unmet.push(`BAB +${p.min}`);
      if (p.kind === 'feat' && !hasCatalog(p.catalogKey))
        unmet.push(
          lookupCatalog(character, p.catalogKey)?.name ?? p.catalogKey,
        );
      if (p.kind === 'classFeature' && !hasCatalog(p.catalogKey))
        unmet.push(
          lookupCatalog(character, p.catalogKey)?.name ?? p.catalogKey,
        );
      if (
        p.kind === 'casterLevel' &&
        !levels.some((l) => classDetail(l.state.classKey)?.casting)
      )
        unmet.push(`caster level ${p.min}`);
    }
    if (unmet.length)
      out.push({
        id: `${entry.id}-prereq`,
        severity: 'warning',
        where: `entry:${entry.id}`,
        message: `${entryName(character, entry)} needs ${unmet.join(', ')}.`,
      });
    if (
      catalog.detail.choice &&
      !('choice' in entry.state && entry.state.choice)
    )
      out.push({
        id: `${entry.id}-choice`,
        severity: 'info',
        where: `entry:${entry.id}`,
        message: `${catalog.name}: choose a ${catalog.detail.choice}.`,
      });
  }
  const slots = featSlots(character);
  if (slots.taken !== slots.slots.length)
    out.push({
      id: 'feat-count',
      severity: slots.taken > slots.slots.length ? 'warning' : 'prompt',
      where: 'feats',
      message:
        slots.taken > slots.slots.length
          ? `${slots.taken} feats for ${slots.slots.length} feat slots.`
          : `${slots.slots.length - slots.taken} feat slot${slots.slots.length - slots.taken === 1 ? '' : 's'} open.`,
    });

  // Duplicated class features that the rules upgrade.
  const seen = new Map<string, number>();
  for (const entry of character.entries)
    if (entry.kind === 'classFeature' && entry.active && entry.catalogKey)
      seen.set(entry.catalogKey, (seen.get(entry.catalogKey) ?? 0) + 1);
  for (const [key, count] of seen) {
    const catalog = lookupCatalog(character, key);
    if (
      catalog?.detail.kind !== 'classFeature' ||
      count < 2 ||
      catalog.stacksWithItself
    )
      continue;
    const upgrade = catalog.detail.duplicateUpgrade;
    if (!upgrade) {
      out.push({
        id: `dup-${key}`,
        severity: 'warning',
        where: 'features',
        message: `${catalog.name} appears ${count} times; duplicates don’t stack.`,
      });
      continue;
    }
    if (hasCatalog(upgrade.catalogKey)) continue;
    const name =
      lookupCatalog(character, upgrade.catalogKey)?.name ?? upgrade.catalogKey;
    const latest = character.entries
      .filter((e) => e.catalogKey === key && e.gainedAtClassLevel)
      .map((e) => e.gainedAtClassLevel!)
      .sort(
        (a, b) =>
          (levels.find((l) => l.id === b)?.state.position ?? 0) -
          (levels.find((l) => l.id === a)?.state.position ?? 0),
      )[0];
    out.push({
      id: `upgrade-${key}`,
      severity: 'prompt',
      where: 'features',
      message: `${catalog.name} from two classes: ${upgrade.rule} Add ${name}?`,
      action: {
        kind: 'addEntry',
        label: `Add ${name}`,
        catalogKey: upgrade.catalogKey,
        gainedAtClassLevel: latest,
      },
    });
  }

  out.push(...spellWarnings(character));

  for (const note of permanent.notes)
    out.push({
      id: `note-${note}`,
      severity: 'warning',
      where: 'sheet',
      message: note,
    });

  return out;
}
