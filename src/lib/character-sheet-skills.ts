import {
  abilityLabels,
  builtIn,
  composeStatistics,
  type Ability,
  type LeafTarget,
  type ResolvedStatistic,
  type SourcedModifier,
} from './character-sheet';
import type { resolveEquipment } from './character-sheet-equipment';
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
  advancement,
  abilities,
  breakdowns,
  equipment,
}: {
  advancement: ReturnType<typeof resolveAdvancement>;
  abilities: Record<Ability, { modifier: number }>;
  breakdowns: Readonly<Record<LeafTarget, ResolvedStatistic>>;
  equipment: ReturnType<typeof resolveEquipment>;
}) {
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
    const skillArmor = appliesArmorCheckPenalty(ability) ? equipment.items : [];
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
        ...skillArmor.map(({ entryId, name, armorCheckPenalty }) =>
          builtIn({
            target: key,
            id: entryId,
            sheetEntryId: entryId,
            name: `${name} armor check penalty`,
            value: armorCheckPenalty,
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
        (sum, item) => sum + item.armorCheckPenalty,
        0,
      ),
    };
  });
  return { skills, breakdowns: skillBreakdowns, warnings: equipment.warnings };
}
