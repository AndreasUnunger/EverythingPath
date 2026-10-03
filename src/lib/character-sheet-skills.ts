import {
  abilityLabels,
  isTemporaryEffect,
  builtIn,
  composeStatistics,
  type Ability,
  type CharacterSheetInput,
  type LeafTarget,
  type ResolvedStatistic,
  type SourcedModifier,
  type SheetWarning,
} from './character-sheet';
import type { resolveAdvancement } from './character-sheet-advancement';

export const skillDefinitions = [
  { key: 'skill.acr', name: 'Acrobatics', ability: 'dexterity' },
  { key: 'skill.apr', name: 'Appraise', ability: 'intelligence' },
  { key: 'skill.blf', name: 'Bluff', ability: 'charisma' },
  { key: 'skill.clm', name: 'Climb', ability: 'strength' },
  { key: 'skill.crf', name: 'Craft', ability: 'intelligence' },
  { key: 'skill.dip', name: 'Diplomacy', ability: 'charisma' },
  { key: 'skill.dev', name: 'Disable Device', ability: 'dexterity' },
  { key: 'skill.dis', name: 'Disguise', ability: 'charisma' },
  { key: 'skill.esc', name: 'Escape Artist', ability: 'dexterity' },
  { key: 'skill.fly', name: 'Fly', ability: 'dexterity' },
  { key: 'skill.han', name: 'Handle Animal', ability: 'charisma' },
  { key: 'skill.hea', name: 'Heal', ability: 'wisdom' },
  { key: 'skill.int', name: 'Intimidate', ability: 'charisma' },
  { key: 'skill.kar', name: 'Knowledge (arcana)', ability: 'intelligence' },
  {
    key: 'skill.kdu',
    name: 'Knowledge (dungeoneering)',
    ability: 'intelligence',
  },
  {
    key: 'skill.ken',
    name: 'Knowledge (engineering)',
    ability: 'intelligence',
  },
  { key: 'skill.kge', name: 'Knowledge (geography)', ability: 'intelligence' },
  { key: 'skill.khi', name: 'Knowledge (history)', ability: 'intelligence' },
  { key: 'skill.klo', name: 'Knowledge (local)', ability: 'intelligence' },
  { key: 'skill.kna', name: 'Knowledge (nature)', ability: 'intelligence' },
  { key: 'skill.kno', name: 'Knowledge (nobility)', ability: 'intelligence' },
  { key: 'skill.kpl', name: 'Knowledge (planes)', ability: 'intelligence' },
  { key: 'skill.kre', name: 'Knowledge (religion)', ability: 'intelligence' },
  { key: 'skill.lin', name: 'Linguistics', ability: 'intelligence' },
  { key: 'skill.per', name: 'Perception', ability: 'wisdom' },
  { key: 'skill.prf', name: 'Perform', ability: 'charisma' },
  { key: 'skill.pro', name: 'Profession', ability: 'wisdom' },
  { key: 'skill.rid', name: 'Ride', ability: 'dexterity' },
  { key: 'skill.sen', name: 'Sense Motive', ability: 'wisdom' },
  { key: 'skill.slt', name: 'Sleight of Hand', ability: 'dexterity' },
  { key: 'skill.spl', name: 'Spellcraft', ability: 'intelligence' },
  { key: 'skill.ste', name: 'Stealth', ability: 'dexterity' },
  { key: 'skill.sur', name: 'Survival', ability: 'wisdom' },
  { key: 'skill.swm', name: 'Swim', ability: 'strength' },
  { key: 'skill.umd', name: 'Use Magic Device', ability: 'charisma' },
] as const satisfies readonly {
  key: LeafTarget;
  name: string;
  ability: Ability;
}[];

export type SkillTarget = (typeof skillDefinitions)[number]['key'];

export type SkillRankBudget = {
  kind: 'ordinary';
  skillRanks: number | null;
  skillRankCap: number;
};
// Companion budgets follow their own progression rules; ordinary level budgets
// must not be reused for fixed or allocated companion budgets.

export function ordinarySkillRanksPerLevel({
  baseRanks,
  intelligence,
  racialRanks = 0,
  favoredClassRanks = 0,
}: {
  baseRanks: number;
  intelligence: number;
  racialRanks?: number;
  favoredClassRanks?: number;
}) {
  return (
    Math.max(1, baseRanks + intelligence) + racialRanks + favoredClassRanks
  );
}

const skillKeyPrefix = 'skill.';

export function canonicalSkillKey(key: string): SkillTarget | undefined {
  return skillDefinitions.find(
    (skill) =>
      skill.key === key || skill.key.slice(skillKeyPrefix.length) === key,
  )?.key;
}

export function sumRanksBySkill(record: Readonly<Record<string, number>>) {
  const totals: Partial<Record<SkillTarget, number>> = {};
  for (const [key, ranks] of Object.entries(record)) {
    const skill = canonicalSkillKey(key);
    if (skill) totals[skill] = (totals[skill] ?? 0) + ranks;
  }
  return totals;
}

function armorPenalties(input: CharacterSheetInput, permanentOnly: boolean) {
  const warnings: SheetWarning[] = [];
  const penalties = input.entries.flatMap((entry) => {
    if (entry.kind !== 'item' || !entry.active) return [];
    const catalog = input.catalogEntries.find(
      (candidate) => candidate._id === entry.catalogEntryId,
    );
    if (
      catalog?.detail?.kind !== 'item' ||
      !catalog.detail.armor ||
      (permanentOnly && isTemporaryEffect(entry, catalog.detail))
    )
      return [];
    const enhancement = entry.state.enhancement;
    const { armorCheckPenalty } = catalog.detail.armor;
    const name =
      catalog.name ??
      (catalog.detail.armor.slot === 'shield' ? 'Shield' : 'Armor');
    const problem =
      enhancement !== undefined &&
      (!Number.isInteger(enhancement) || enhancement < 0)
        ? 'Enhancement must be a nonnegative whole number.'
        : !Number.isFinite(armorCheckPenalty) || armorCheckPenalty < 0
          ? 'Armor check penalty must be a nonnegative number.'
          : null;
    if (problem) {
      warnings.push({
        kind: 'unresolved',
        check: 'armorCheckPenaltyUnresolved',
        subject: entry._id,
        target: { kind: 'entry', entryId: entry._id },
        fingerprint: JSON.stringify([
          name,
          String(enhancement),
          String(armorCheckPenalty),
          problem,
        ]),
        message: `${name} armor check penalty is unresolved. ${problem} This item's penalty is omitted from Strength and Dexterity skill totals.`,
      });
      return [];
    }
    const masterwork =
      entry.state.masterwork === true || (enhancement ?? 0) >= 1;
    return [
      {
        entryId: entry._id,
        name,
        penalty: -Math.max(0, armorCheckPenalty - (masterwork ? 1 : 0)),
      },
    ];
  });
  return { penalties, warnings };
}

function rankContributions(advancement: ReturnType<typeof resolveAdvancement>) {
  return advancement.rows.map(({ entry }) => ({
    entryId: entry._id,
    position: entry.state.position,
    ranks: sumRanksBySkill(entry.state.skillRanks ?? {}),
  }));
}

function classSkills(advancement: ReturnType<typeof resolveAdvancement>) {
  return new Set(
    advancement.rows.flatMap(({ detail }) =>
      (detail?.classSkills ?? []).flatMap((skill) => {
        const key = canonicalSkillKey(skill);
        return key ? [key] : [];
      }),
    ),
  );
}

function appliesArmorCheckPenalty(ability: Ability) {
  return ability === 'strength' || ability === 'dexterity';
}

export function resolveSkills({
  input,
  advancement,
  abilities,
  breakdowns,
  permanentOnly = false,
}: {
  input: CharacterSheetInput;
  advancement: ReturnType<typeof resolveAdvancement>;
  abilities: Record<Ability, { modifier: number }>;
  breakdowns: Readonly<Record<LeafTarget, ResolvedStatistic>>;
  permanentOnly?: boolean;
}) {
  const armor = armorPenalties(input, permanentOnly);
  const rankedLevels = rankContributions(advancement);
  const availableClassSkills = classSkills(advancement);
  const skillBreakdowns: Partial<Record<SkillTarget, ResolvedStatistic>> = {};
  const skills = skillDefinitions.map(({ key, name, ability }) => {
    const rankModifiers: SourcedModifier[] = rankedLevels.flatMap((level) => {
      const ranks = level.ranks[key] ?? 0;
      return ranks
        ? [
            builtIn({
              target: key,
              id: level.entryId,
              sheetEntryId: level.entryId,
              name: `Class Level ${level.position} ranks`,
              value: ranks,
              isBase: true,
            }),
          ]
        : [];
    });
    const ranks = rankModifiers.reduce(
      (sum, modifier) => sum + modifier.value,
      0,
    );
    const classSkill = availableClassSkills.has(key);
    const skillArmor = appliesArmorCheckPenalty(ability) ? armor.penalties : [];
    skillBreakdowns[key] = composeStatistics({
      statistics: [breakdowns[key]],
      builtIns: [
        ...rankModifiers,
        builtIn({
          target: key,
          id: `${key}:ability`,
          name: abilityLabels[ability],
          value: abilities[ability].modifier,
        }),
        ...(ranks > 0 && classSkill
          ? [
              builtIn({
                target: key,
                id: `${key}:class`,
                name: 'Class skill',
                value: 3,
              }),
            ]
          : []),
        ...skillArmor.map(({ entryId, name, penalty }) =>
          builtIn({
            target: key,
            id: entryId,
            sheetEntryId: entryId,
            name: `${name} armor check penalty`,
            value: penalty,
          }),
        ),
      ],
      includes: () => true,
      name,
    });
    return {
      key,
      name,
      ability,
      ranks,
      classSkill,
      armorCheckPenalty: skillArmor.reduce(
        (sum, item) => sum + item.penalty,
        0,
      ),
    };
  });
  return { skills, breakdowns: skillBreakdowns, warnings: armor.warnings };
}
