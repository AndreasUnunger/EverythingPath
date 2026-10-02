import type { ImportKind } from './inventory.ts';
import {
  sourceDescription,
  uuidKey,
  type SourceRecord,
  type LoadedRecord,
  type Unsupported,
} from './records.ts';
import {
  readObject,
  readArray,
  readStrings,
  readNumber,
  readText,
  parseDelimitedStrings,
  skillNames,
} from './values.ts';

type DetailContext = {
  record: SourceRecord;
  resolveKey: (key: string) => string | undefined;
  lookup: ReadonlyMap<string, LoadedRecord>;
  spellClassTags: ReadonlySet<string>;
  unsupported: Unsupported[];
};

function mapProgression(system: Record<string, unknown>) {
  const saves = readObject(system.savingThrows);
  const babProgressions = new Map([
    ['high', 'full'],
    ['med', 'threeQuarters'],
  ]);
  return {
    hitDie: readNumber({ value: system.hd, fallback: 8 }),
    bab: babProgressions.get(readText({ value: system.bab })) ?? 'half',
    saves: Object.fromEntries(
      ['fort', 'ref', 'will'].map((key) => [
        key,
        readObject(saves[key]).value === 'high' ? 'good' : 'poor',
      ]),
    ),
    classSkills: Object.entries(readObject(system.classSkills))
      .filter(([, value]) => value === true)
      .map(([key]) => skillNames[key] ?? key)
      .sort(),
  };
}

function mapRace({ record: { system } }: DetailContext) {
  return {
    kind: 'race' as const,
    racialHitDice: readNumber({ value: system.racialHitDice, fallback: 0 }),
    creatureTypes: readStrings(system.creatureTypes),
    creatureSubtypes: readStrings(system.creatureSubtypes),
  };
}

function mapClassFeatures({
  record: { system },
  resolveKey,
  unsupported,
}: DetailContext) {
  return readArray(readObject(system.links).classAssociations).flatMap(
    (value) => {
      const link = readObject(value);
      const upstream = uuidKey(readText({ value: link.uuid }));
      const key = upstream && resolveKey(upstream);
      if (key) return [{ classLevel: link.level, externalKey: key }];
      unsupported.push({
        field: 'links.classAssociations',
        reason: 'Missing or out-of-scope feature reference.',
        value: { level: link.level, uuid: readText({ value: link.uuid }) },
      });
      return [];
    },
  );
}

function mapCasting({ record: { system }, unsupported }: DetailContext) {
  const casting = readObject(system.casting);
  if (!Object.keys(casting).length) return {};
  unsupported.push({
    field: 'casting',
    reason: 'Casting tables and class schedules require feature curation.',
  });
  return {
    casting: {
      ability: casting.ability,
      spellKind: casting.spells,
      casterLevelOffset: casting.offset,
      type: casting.type,
    },
  };
}

function mapClass(context: DetailContext) {
  const { system } = context.record;
  const classKinds = new Map([
    ['prestige', 'prestige'],
    ['npc', 'npc'],
  ]);
  return {
    kind: 'class' as const,
    ...mapProgression(system),
    tag: readText({ value: system.tag }),
    classKind: classKinds.get(readText({ value: system.subType })) ?? 'base',
    skillRanksPerLevel: readNumber({
      value: system.skillsPerLevel,
      fallback: 2,
    }),
    featuresByLevel: mapClassFeatures(context),
    ...mapCasting(context),
  };
}

function mapCreatureType(context: DetailContext) {
  const { system } = context.record;
  mapClassFeatures(context);
  return {
    kind: 'creatureType' as const,
    ...mapProgression(system),
    tag: readText({ value: system.tag }),
    skillRanksPerHitDie: readNumber({
      value: system.skillsPerLevel,
      fallback: 2,
    }),
  };
}

function mapClassFeature() {
  return { kind: 'classFeature' as const };
}
function mapManual() {
  return { kind: 'manual' as const };
}
function mapFeat({ record: { system } }: DetailContext) {
  return {
    kind: 'feat' as const,
    featTypes: readStrings(system.tags),
    repeatable: 'unreviewed',
  };
}
function mapTrait({ record: { system } }: DetailContext) {
  return {
    kind: 'trait' as const,
    traitType: readText({ value: system.traitType }),
  };
}
function mapRacialTrait({ record: { system } }: DetailContext) {
  return {
    kind: 'racialTrait' as const,
    races: readStrings(system.tags),
    bonusSkillRanksPerLevel: readNumber({
      value: system.bonusSkillRanks,
      fallback: 0,
    }),
  };
}

function mapSpell({
  record: { system },
  spellClassTags,
  unsupported,
}: DetailContext) {
  const learnedAt = readObject(system.learnedAt);
  const levels = readObject(learnedAt.class);
  for (const tag of Object.keys(levels))
    if (!spellClassTags.has(tag))
      unsupported.push({
        field: `levels.${tag}`,
        reason: 'No class with this tag in the extracted inputs.',
        value: levels[tag],
      });
  return {
    kind: 'spell' as const,
    levels,
    grantedLevels: Object.fromEntries(
      Object.entries(learnedAt).filter(([key]) => key !== 'class'),
    ),
    school: readText({ value: system.school }),
    subschools: parseDelimitedStrings(system.subschool),
    descriptors: parseDelimitedStrings(system.types),
  };
}

function normalizeSpellName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split(',')
    .reverse()
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function mapSpellAssociation({
  record,
  lookup,
  resolveKey,
  unsupported,
}: DetailContext) {
  const link =
    /@(?:UUID\[Compendium\.|Compendium\[)(pf1\.spells\.(?:Item\.)?[A-Za-z0-9]+)\]/.exec(
      sourceDescription(record),
    );
  const key = link?.[1] && uuidKey(`Compendium.${link[1]}`);
  const spellName = key && lookup.get(key)?.record.name;
  if (
    key &&
    spellName &&
    normalizeSpellName(spellName) === normalizeSpellName(record.name)
  )
    return { spellKey: resolveKey(key) };
  unsupported.push({
    field: 'spellKey',
    reason: 'Spell effect needs a reviewed spell association.',
    value: key ?? null,
  });
  return {};
}

function mapSpellEffect(context: DetailContext) {
  const {
    record: { system },
    unsupported,
  } = context;
  const duration = readObject(system.duration);
  const multiplier: Record<string, number> = {
    round: 6,
    minute: 60,
    hour: 3600,
    day: 86400,
  };
  const seconds =
    readNumber({ value: duration.value, fallback: Number.NaN }) *
    (multiplier[readText({ value: duration.units })] ?? Number.NaN);
  if (!Number.isFinite(seconds) && duration.units !== 'perm')
    unsupported.push({
      field: 'duration',
      reason:
        'Duration requires reviewed formula interpretation; permanent eligibility is not established.',
      value: {
        units: readText({ value: duration.units }),
        value:
          typeof duration.value === 'string' ||
          typeof duration.value === 'number'
            ? duration.value
            : null,
      },
    });
  return {
    kind: 'spellEffect' as const,
    defaultCasterLevel: readNumber({ value: system.level, fallback: 1 }),
    lastsOverOneDay: duration.units === 'perm' || seconds > 86400,
    ...mapSpellAssociation(context),
  };
}

function mapWeapon({ record, unsupported }: DetailContext) {
  const { system } = record;
  const actions = readArray(system.actions).map(readObject);
  const first = actions.find((action) => action.name === 'Bash') ?? actions[0];
  if (!['weapon', 'attack'].includes(record.type) && first?.name !== 'Bash')
    return {};
  const damage = readObject(readArray(readObject(first?.damage).parts)[0]);
  const dice = /^sizeRoll\(\s*(\d+)\s*,\s*(\d+)\s*,\s*@size\s*\)$/.exec(
    readText({ value: damage.formula }),
  );
  const ability = readObject(first?.ability);
  const ranged = actions.find(
    (action) => readObject(action.range).units === 'ft',
  );
  const rangeIncrement = ranged
    ? Number(readObject(ranged.range).value)
    : Number.NaN;
  if (!dice)
    unsupported.push({
      field: 'weapon.damage',
      reason: 'Damage formula needs feature mapping.',
      value: readText({ value: damage.formula }),
    });
  return {
    weapon: {
      baseTypes: readStrings(system.baseTypes),
      groups: readStrings(system.weaponGroups),
      proficiency:
        system.proficient === true
          ? 'always'
          : readText({ value: system.subType, fallback: 'simple' }),
      handedness: readText({ value: system.weaponSubtype, fallback: 'light' }),
      dice: dice ? `${dice[1]}d${dice[2]}` : null,
      damageTypes: readStrings(damage.types),
      threat: readNumber({ value: ability.critRange, fallback: 20 }),
      mult: readNumber({ value: ability.critMult, fallback: 2 }),
      finesse: readObject(system.properties).fin === true,
      thrown: actions.some((action) => action.actionType === 'twak'),
      ...(Number.isFinite(rangeIncrement) ? { rangeIncrement } : {}),
    },
  };
}

function mapArmor(system: Record<string, unknown>) {
  const armor = readObject(system.armor);
  if (!Object.keys(armor).length) return {};
  return {
    armor: {
      slot: system.equipmentType === 'shield' ? 'shield' : 'armor',
      category: readText({ value: system.equipmentSubtype }),
      bonus: readNumber({ value: armor.value, fallback: 0 }),
      maxDex: armor.dex ?? null,
      acp: readNumber({ value: armor.acp, fallback: 0 }),
      asf: readNumber({ value: system.spellFailure, fallback: 0 }),
    },
  };
}

function mapItemMagic(system: Record<string, unknown>) {
  const armor = readObject(system.armor);
  if (system.enh === undefined && armor.enh === undefined) return {};
  return {
    magic: {
      enhancement: readNumber({ value: armor.enh ?? system.enh, fallback: 0 }),
      masterwork: system.masterwork === true,
    },
  };
}

function mapItem(context: DetailContext) {
  const { record } = context;
  const { system } = record;
  return {
    kind: 'item' as const,
    consumable: record.type === 'consumable',
    price: readNumber({ value: system.price, fallback: 0 }),
    weight: readNumber({ value: readObject(system.weight).value, fallback: 0 }),
    ...mapWeapon(context),
    ...mapArmor(system),
    ...mapItemMagic(system),
  };
}

function mapItemAbility({ record: { system }, unsupported }: DetailContext) {
  const applies: Record<string, string> = {
    'Universal Weapon Qualities': 'weapon',
    'Melee Qualities': 'melee',
    'Ranged Qualities': 'ranged',
    'Armor Qualities': 'armor',
    'Shield Qualities': 'shield',
    'Armor and Shield Qualities': 'armorOrShield',
  };
  unsupported.push({
    field: 'itemAbility',
    reason:
      'Bonus equivalent, dice and conditional mechanics require reviewed curation.',
  });
  return {
    kind: 'itemAbility' as const,
    appliesTo:
      readStrings(system.tags)
        .map((tag) => applies[tag])
        .find(Boolean) ?? null,
  };
}

function recordCompanionCuration(unsupported: Unsupported[]) {
  unsupported.push({
    field: 'companion',
    reason:
      'Companion templates, embedded items and progression need feature-owned resources; actor IDs are not playable definitions.',
  });
}

function mapCompanionFeatureFields({
  record: { system },
  unsupported,
}: DetailContext) {
  recordCompanionCuration(unsupported);
  return {
    tag: readText({ value: system.tag }),
    associations: readStrings(readObject(system.associations).classes),
  };
}
function mapCompanionFields({
  record: { system },
  unsupported,
}: DetailContext) {
  recordCompanionCuration(unsupported);
  return {
    abilities: Object.fromEntries(
      Object.entries(readObject(system.abilities)).map(([key, value]) => [
        key,
        readObject(value).value,
      ]),
    ),
    size: readObject(system.traits).size,
    creatureTypes: readStrings(readObject(system.traits).creatureTypes),
  };
}
function mapCompanionFeature(context: DetailContext) {
  return {
    kind: 'companionFeature' as const,
    ...mapCompanionFeatureFields(context),
  };
}
function mapCompanion(context: DetailContext) {
  return { kind: 'companion' as const, ...mapCompanionFields(context) };
}
function mapFamiliar(context: DetailContext) {
  return { kind: 'familiar' as const, ...mapCompanionFields(context) };
}
function mapEidolonForm(context: DetailContext) {
  return { kind: 'eidolonForm' as const, ...mapCompanionFields(context) };
}
function mapEidolonEvolution(context: DetailContext) {
  return {
    kind: 'eidolonEvolution' as const,
    ...mapCompanionFeatureFields(context),
  };
}

export const detailMappers = {
  race: mapRace,
  class: mapClass,
  creatureType: mapCreatureType,
  classFeature: mapClassFeature,
  feat: mapFeat,
  trait: mapTrait,
  racialTrait: mapRacialTrait,
  spell: mapSpell,
  spellEffect: mapSpellEffect,
  item: mapItem,
  itemAbility: mapItemAbility,
  manual: mapManual,
  companionFeature: mapCompanionFeature,
  companion: mapCompanion,
  familiar: mapFamiliar,
  eidolonForm: mapEidolonForm,
  eidolonEvolution: mapEidolonEvolution,
} satisfies Record<
  ImportKind,
  (context: DetailContext) => { kind: ImportKind }
>;

export type PreviewDetail = ReturnType<(typeof detailMappers)[ImportKind]>;
