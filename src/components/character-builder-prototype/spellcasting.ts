// PROTOTYPE (throwaway, #233) — Spellcasting, derived per casting class, as
// in the data model's "Spellcasting" section. Nothing here is stored: a
// Spellcasting exists for each class the Character has Class Levels in whose
// class entry has `casting`. Recorded Spells are `spell` sheet entries naming
// their `castingClass`; granted Spells (domain, bloodline) are derived.
//
// Everything is pure and memoised per Character object.

import {
  CASTING_BY_TAG,
  CATALOG,
  SITUATION_TEXT,
  classDetail,
} from './catalog';
import { CASTING_TABLES, bonusSpells, cell } from './casting-tables';
import {
  evaluateFormula,
  resolveSheet,
  stackLeaf,
  type Evaluated,
} from './resolve';
import {
  classLevelShortLabel,
  classLevels,
  className,
  findClassLevel,
  hitDice,
  levelInClass,
  lookupCatalog,
} from './sheet';
import type {
  AbilityKey,
  CastingAdvance,
  Casting,
  CatalogEntry,
  Character,
  ConditionalContribution,
  Contribution,
  ResolvedSheet,
  SchoolKey,
  SheetEntry,
  SpellDetail,
  Stat,
} from './types';
import type { Warning } from './warnings';

// ----------------------------------------------------------------- labels

export const SCHOOL_LABEL: Record<SchoolKey, string> = {
  abjuration: 'Abjuration',
  conjuration: 'Conjuration',
  divination: 'Divination',
  enchantment: 'Enchantment',
  evocation: 'Evocation',
  illusion: 'Illusion',
  necromancy: 'Necromancy',
  transmutation: 'Transmutation',
  universal: 'Universal',
};

/** "0", "1st", "2nd", "3rd", "4th"… */
export function ordinal(level: number) {
  if (level === 0) return '0';
  if (level === 1) return '1st';
  if (level === 2) return '2nd';
  if (level === 3) return '3rd';
  return `${level}th`;
}

/** "0-level", "1st-level"… */
export const levelText = (level: number) => `${ordinal(level)}-level`;

// ------------------------------------------------------------------ types

export type SpellCatalog = CatalogEntry & { detail: SpellDetail };

export const isSpellCatalog = (
  c: CatalogEntry | undefined,
): c is SpellCatalog => c?.detail.kind === 'spell';

/** Every Spell in the catalog. */
export const SPELL_CATALOG: SpellCatalog[] = CATALOG.filter(isSpellCatalog);

export type SlotRow = {
  /** Spell level 0…9. */
  level: number;
  /**
   * The table's spells per day (0 = bonus spells only), or null when the
   * table has no per-day entry: cantrips cast at will (sorcerer, arcanist).
   */
  base: number | null;
  /** Bonus spells from the casting ability's permanent score (1st+). */
  bonus: number;
  /** The extra domain / school / spirit slot (1st+), 0 or 1. */
  extra: number;
  /** base + bonus + extra; null when cast at will. */
  perDay: number | null;
  /** Spells known (`known` casters). */
  known: number | null;
  /** The arcanist's prepared count. */
  prepared: number | null;
  /** Recorded Spells at this level (granted ones not counted). */
  recorded: number;
  /** Granted Spells at this level. */
  granted: number;
  /** Save DC of a Spell of this level (no school condition). */
  dc: number;
  /** Per-school DCs, only where a `school` condition makes them differ. */
  dcBySchool: { school: SchoolKey; dc: number }[];
};

export type RecordedSpell = {
  entry: SheetEntry & {
    state: { kind: 'spell'; castingClass: string; level: number | null };
  };
  catalog: SpellCatalog;
  /** Its level for this Spellcasting: the list's, the entry's own (off-list), or null (off-list, not set). */
  level: number | null;
  /** On the class's list. */
  onList: boolean;
  /** Off the list and not granted: the level field is the entry's own and editable. */
  offList: boolean;
  /** Of an opposition school: takes two slots to prepare ("2 slots"). */
  opposition: boolean;
  /** Above the highest level the Spellcasting can cast now. */
  tooHigh: boolean;
};

export type GrantedSpell = {
  catalog: SpellCatalog;
  level: number;
  /** "Fire domain", "Arcane bloodline" — one per granting feature. */
  from: string[];
  opposition: boolean;
  /**
   * A domain Spell that isn't on the class's list: "can prepare it only in
   * her domain spell slot" (CRB). Never set for bloodline Spells, which join
   * the sorcerer's list (FAQ).
   */
  domainSlotOnly: boolean;
  /** Schedule-style grants (bloodline): the class level that granted it. */
  grantedAtClassLevel: number | null;
};

export type ExtraSlot = {
  kind: 'domain' | 'school' | 'spirit';
  /** "+1 domain", "+1 school (evocation)", "+1 spirit". */
  label: string;
  /** The granting features' names. */
  from: string[];
};

export type ResolvedSpellcasting = {
  /** The class key, "class.wizard": what a recorded Spell's `castingClass` names. */
  classKey: string;
  className: string;
  casting: Casting;
  /** "Spells known", "Spellbook", "Formula book", "Familiar"; null for `none`. */
  heading: string | null;
  /** Class Levels of the class. */
  classLevels: number;
  /** Prestige advances assigned to it, with the levels they come from. */
  advances: { levelId: string; label: string }[];
  /** Class Levels + advances: the table row read (capped at 20). */
  castingLevel: number;
  /** Null until the table has an entry (a paladin before 4th). */
  casterLevel: Stat | null;
  concentration: Stat | null;
  /** Casting ability, its current score and modifier (DCs, concentration) and permanent score (bonus spells). */
  ability: AbilityKey;
  abilityScore: number;
  abilityMod: number;
  permanentScore: number;
  /** Highest spell level castable now, or null (none yet). */
  highestLevel: number | null;
  /** One row per spell level the table has an entry for (per day, known or prepared). */
  rows: SlotRow[];
  extraSlot: ExtraSlot | null;
  /** An arcane school: the specialist school and its opposition schools. */
  school: {
    entryId: string;
    school: SchoolKey;
    opposition: SchoolKey[];
  } | null;
  /** Recorded Spells, by level then name; empty for `none`. */
  recorded: RecordedSpell[];
  /** Granted Spells at levels it can cast, by level then name. */
  granted: GrantedSpell[];
  /** The breakdown of the save DC of a Spell of `level` (and `school`). */
  dcStat: (level: number, school?: SchoolKey) => Stat;
};

// ------------------------------------------------- casting classes

export function castingOf(classKey: string | null): Casting | null {
  return classDetail(classKey)?.casting ?? null;
}

const tagOf = (classKey: string) => castingOf(classKey)?.classTag ?? null;

/** Spells on a class's list, with their level for it, by level then name. */
export function classSpellList(classKey: string) {
  const tag = tagOf(classKey);
  if (!tag) return [];
  return SPELL_CATALOG.flatMap((catalog) => {
    const level = catalog.detail.levels[tag];
    return level === undefined ? [] : [{ catalog, level }];
  }).sort(
    (a, b) => a.level - b.level || a.catalog.name.localeCompare(b.catalog.name),
  );
}

/** The lowest level of a Spell on any list (default level for an off-list Spell). */
export function lowestLevel(spell: SpellDetail): number | null {
  const all = [
    ...Object.values(spell.levels),
    ...Object.values(spell.grantedLevels).flatMap((m) =>
      Object.values(m ?? {}),
    ),
  ];
  return all.length ? Math.min(...all) : null;
}

// ------------------------------------------------- prestige advances

/** The prestige class's advances for one of its Class Levels (by its level in the class). */
export function advancesAt(
  character: Character,
  levelId: string,
): CastingAdvance[] {
  const level = findClassLevel(character, levelId);
  const detail = classDetail(level?.state.classKey ?? null);
  if (!level || !detail?.castingAdvances) return [];
  const n = levelInClass(character, levelId);
  return detail.castingAdvances
    .filter((a) => a.classLevel === n)
    .flatMap((a) => Array.from({ length: a.count }, () => a));
}

const kindMatches = (kind: CastingAdvance['kind'], casting: Casting) =>
  kind === 'any' || kind === casting.spellKind;

/** Casting classes the Character has levels in, in order of first level. */
function castingClasses(character: Character) {
  const seen: { classKey: string; casting: Casting; firstPosition: number }[] =
    [];
  for (const l of classLevels(character)) {
    const casting = castingOf(l.state.classKey);
    if (casting && !seen.some((s) => s.classKey === l.state.classKey))
      seen.push({
        classKey: l.state.classKey!,
        casting,
        firstPosition: l.state.position,
      });
  }
  return seen;
}

export type AdvanceChoice = {
  index: number;
  kind: CastingAdvance['kind'];
  /** The class key it goes to, or null: not chosen (blue outline). */
  value: string | null;
  /**
   * Every casting class the Character has; `matches` = of the advance's
   * kind AND with Class Levels before the prestige class's FIRST level.
   */
  options: { classKey: string; name: string; matches: boolean }[];
};

/** A prestige Class Level's advance choices, or [] for any other level. */
export function advanceChoices(
  character: Character,
  levelId: string,
): AdvanceChoice[] {
  const level = findClassLevel(character, levelId);
  if (!level) return [];
  const classes = castingClasses(character);
  const firstPrestige = firstPositionOf(character, level.state.classKey);
  return advancesAt(character, levelId).map((a, index) => ({
    index,
    kind: a.kind,
    value: level.state.castingAdvances[index] ?? null,
    options: classes.map((c) => ({
      classKey: c.classKey,
      name: className(c.classKey),
      matches:
        kindMatches(a.kind, c.casting) && c.firstPosition < firstPrestige,
    })),
  }));
}

/** The position of the Character's first Class Level in a class (Infinity if none). */
function firstPositionOf(character: Character, classKey: string | null) {
  return (
    classLevels(character).find((l) => l.state.classKey === classKey)?.state
      .position ?? Infinity
  );
}

/** The pre-fill for a prestige level's advances: a class only when exactly one qualifies. */
export function prefillAdvances(
  character: Character,
  levelId: string,
): (string | null)[] {
  return advanceChoices(character, levelId).map((choice) => {
    const qualifying = choice.options.filter((o) => o.matches);
    return qualifying.length === 1 ? qualifying[0]!.classKey : null;
  });
}

// -------------------------------------------------- the derivation

type Mod = Evaluated & { situationText?: string; schoolKey?: SchoolKey };

/** Authored `casterLevel` / `spellDC` / `concentration` Modifiers that reach this Spellcasting. */
function spellModifiers(
  character: Character,
  sheet: ResolvedSheet,
  target: 'casterLevel' | 'spellDC' | 'concentration',
  classTag: string,
  casterLevelBefore: number,
) {
  const out: { mod: Mod; situational: boolean; school?: SchoolKey }[] = [];
  const activeKeys = new Set(
    character.entries.flatMap((e) =>
      e.active && e.catalogKey ? [e.catalogKey] : [],
    ),
  );
  const ctx = {
    level: classLevels(character).length,
    hitDice: hitDice(character),
    bab: sheet.bab.total,
    classLevel: {} as Record<string, number>,
    abilityMod: Object.fromEntries(
      Object.entries(sheet.abilityMods).map(([k, v]) => [k, v.total]),
    ),
    casterLevel: casterLevelBefore,
  };
  for (const l of classLevels(character))
    if (l.state.classKey) {
      const slug = l.state.classKey.replace(/^class\./, '');
      ctx.classLevel[slug] = (ctx.classLevel[slug] ?? 0) + 1;
    }
  for (const entry of character.entries) {
    if (!entry.active || !entry.catalogKey) continue;
    const catalog = lookupCatalog(character, entry.catalogKey);
    if (!catalog) continue;
    const choice =
      'choice' in entry.state ? (entry.state.choice ?? null) : null;
    for (const m of catalog.modifiers) {
      if (m.target !== target) continue;
      const cond = m.condition;
      if (cond?.castingClass) {
        const wanted =
          cond.castingClass === '$choice' ? choice : cond.castingClass;
        if (wanted !== classTag) continue;
      }
      if (cond?.whileActive && !activeKeys.has(cond.whileActive.catalogKey))
        continue;
      const school =
        cond?.school === '$choice'
          ? ((choice as SchoolKey | null) ?? undefined)
          : cond?.school;
      if (cond?.school && !school) continue; // Spell Focus with no school chosen
      let value: number;
      if (typeof m.value === 'number') value = m.value;
      else {
        const r = evaluateFormula(m.value.formula, ctx, 5);
        if ('error' in r) continue;
        value = r.value;
      }
      const situationText = cond?.situation?.text;
      out.push({
        mod: {
          label: catalog.name + (school ? ` (${school})` : ''),
          bonusType: m.bonusType,
          value,
          builtIn: false,
          temporary: false,
          target: 'derived',
          entryId: entry.id,
          source: catalog.sourceKey ?? catalog.key,
          stacksWithItself: catalog.stacksWithItself,
          ...(situationText || school
            ? {
                conditionText: [situationText, school && `${school} spells`]
                  .filter(Boolean)
                  .join(', '),
              }
            : {}),
          ...(cond?.situation ? { situationKey: cond.situation.key } : {}),
        },
        situational: Boolean(cond?.situation),
        school,
      });
    }
  }
  return out;
}

const builtIn = (
  label: string,
  value: number,
  bonusType: Contribution['bonusType'] = 'untyped',
): Contribution => ({
  label,
  value,
  bonusType,
  builtIn: true,
  temporary: false,
  target: 'derived',
});

/** Stacks built-ins with authored Modifiers; situational ones wait in `conditional`. */
function statOf(
  builtIns: Contribution[],
  mods: { mod: Mod; situational: boolean }[],
): Stat {
  const { applied, suppressed } = stackLeaf(
    mods.filter((m) => !m.situational).map((m) => m.mod),
  );
  const conditional: ConditionalContribution[] = mods
    .filter((m) => m.situational)
    .map(({ mod }) => {
      const { source: _s, stacksWithItself: _w, ...c } = mod;
      return { ...c, conditionText: mod.conditionText ?? '' };
    });
  const all = [...builtIns, ...applied];
  return {
    total: all.reduce((a, c) => a + c.value, 0),
    applied: all,
    suppressed,
    conditional,
  };
}

const memo = new WeakMap<Character, ResolvedSpellcasting[]>();

/** Every Spellcasting of a Character, in order of the class's first level. */
export function spellcastingsOf(character: Character): ResolvedSpellcasting[] {
  const hit = memo.get(character);
  if (hit) return hit;
  const sheet = resolveSheet(character);
  const permanent = resolveSheet(character, { permanentOnly: true });
  const levels = classLevels(character);
  const classes = castingClasses(character);
  const result = classes.map(({ classKey, casting }) =>
    resolveOne(
      character,
      sheet,
      permanent,
      levels,
      classKey,
      casting,
      classes.length,
    ),
  );
  memo.set(character, result);
  return result;
}

/** The Spellcastings a class feature entry belongs to: its level's class, or the only one. */
function featureSpellcasting(
  character: Character,
  entry: SheetEntry,
  castingCount: number,
): string | null {
  if (entry.gainedAtClassLevel) {
    const level = findClassLevel(character, entry.gainedAtClassLevel);
    return level?.state.classKey ?? null;
  }
  if (castingCount === 1) return castingClasses(character)[0]!.classKey;
  return null;
}

function resolveOne(
  character: Character,
  sheet: ResolvedSheet,
  permanent: ResolvedSheet,
  levels: ReturnType<typeof classLevels>,
  classKey: string,
  casting: Casting,
  castingCount: number,
): ResolvedSpellcasting {
  const tables = CASTING_TABLES[casting.table];
  const own = levels.filter((l) => l.state.classKey === classKey).length;
  const advances = levels.flatMap((l) =>
    l.state.castingAdvances
      .map((to, i) => ({ to, i }))
      .filter(({ to }) => to === classKey)
      .map(() => ({
        levelId: l.id,
        label: classLevelShortLabel(character, l.id),
      })),
  );
  const castingLevel = own + advances.length;
  const ability = casting.ability;
  const abilityScore = sheet.abilities[ability].total;
  const abilityMod = sheet.abilityMods[ability].total;
  const permanentScore = permanent.abilities[ability].total;
  const name = className(classKey);
  const ABILITY = ability[0]!.toUpperCase() + ability.slice(1);

  // Features of this Spellcasting: extra slot, school, granted lists.
  const features = character.entries.flatMap((e) => {
    if (e.kind !== 'classFeature' || !e.active) return [];
    const catalog = lookupCatalog(character, e.catalogKey);
    const sc =
      catalog?.detail.kind === 'classFeature'
        ? catalog.detail.spellcasting
        : undefined;
    if (!sc || featureSpellcasting(character, e, castingCount) !== classKey)
      return [];
    return [{ entry: e, catalog: catalog!, sc }];
  });
  const extraFeatures = features.filter((f) => f.sc.extraSlot);
  const schoolFeature = features.find((f) => f.sc.school);
  const school = schoolFeature
    ? {
        entryId: schoolFeature.entry.id,
        school: schoolFeature.sc.school!,
        opposition:
          schoolFeature.entry.state.kind === 'classFeature'
            ? (schoolFeature.entry.state.oppositionSchools ?? [])
            : [],
      }
    : null;
  const extraSlot: ExtraSlot | null = extraFeatures.length
    ? (() => {
        const kind = extraFeatures[0]!.sc.extraSlot!;
        return {
          kind,
          label:
            kind === 'school'
              ? `+1 school (${school?.school ?? 'school'})`
              : kind === 'domain'
                ? '+1 domain'
                : '+1 spirit',
          from: extraFeatures.map((f) => f.catalog.name),
        };
      })()
    : null;

  // Highest castable level: the per day, spells known OR prepared table has an entry.
  let highestLevel: number | null = null;
  for (let l = 0; l <= 9; l++)
    if (
      cell(tables.spellsPerDay, castingLevel, l) !== null ||
      cell(tables.spellsKnown, castingLevel, l) !== null ||
      cell(tables.preparedPerDay, castingLevel, l) !== null
    )
      highestLevel = l;

  // Caster level: class levels + offset + advances + casterLevel Modifiers.
  const clBuiltIns: Contribution[] = [builtIn(`${name} ${own}`, own, 'base')];
  if (casting.casterLevelOffset)
    clBuiltIns.push(
      builtIn(`${name} caster level offset`, casting.casterLevelOffset),
    );
  for (const a of advances)
    clBuiltIns.push(builtIn(`Advance from ${a.label}`, 1));
  const clBefore = clBuiltIns.reduce((s, c) => s + c.value, 0);
  const casterLevel =
    highestLevel === null
      ? null
      : statOf(
          clBuiltIns,
          spellModifiers(
            character,
            sheet,
            'casterLevel',
            casting.classTag,
            clBefore,
          ),
        );
  const concentration = casterLevel
    ? statOf(
        [
          builtIn('Caster level', casterLevel.total, 'base'),
          builtIn(`${ABILITY} modifier`, abilityMod),
        ],
        spellModifiers(
          character,
          sheet,
          'concentration',
          casting.classTag,
          clBefore,
        ),
      )
    : null;

  const dcMods = spellModifiers(
    character,
    sheet,
    'spellDC',
    casting.classTag,
    clBefore,
  );
  const dcStat = (level: number, sch?: SchoolKey) =>
    statOf(
      [
        builtIn('Base', 10, 'base'),
        builtIn(`Spell level ${level}`, level),
        builtIn(`${ABILITY} modifier`, abilityMod),
      ],
      dcMods.filter((m) => !m.school || m.school === sch),
    );
  const dcSchools = [
    ...new Set(dcMods.flatMap((m) => (m.school ? [m.school] : []))),
  ];

  // Granted Spells.
  const grantedMap = new Map<string, GrantedSpell>();
  for (const f of features) {
    const g = f.sc.grants;
    if (!g) continue;
    for (const catalog of SPELL_CATALOG) {
      const level = catalog.detail.grantedLevels[g.list]?.[g.key];
      if (level === undefined) continue;
      let at: number | null = null;
      if (g.schedule === 'slot') {
        // Slot-style (domain): every level it can cast, advances included.
        if (highestLevel === null || level > highestLevel) continue;
      } else {
        // Schedule-style (bloodline): the class's own Class Levels only.
        at =
          g.list === 'bloodline'
            ? (catalog.detail.grantedAtClassLevel.bloodline?.[g.key] ?? null)
            : null;
        if (at === null || own < at) continue;
      }
      const held = grantedMap.get(catalog.key);
      if (held) held.from.push(f.catalog.name);
      else
        grantedMap.set(catalog.key, {
          catalog,
          level,
          from: [f.catalog.name],
          opposition: Boolean(
            school?.opposition.includes(catalog.detail.school),
          ),
          domainSlotOnly:
            g.list !== 'bloodline' &&
            catalog.detail.levels[casting.classTag] === undefined,
          grantedAtClassLevel: at,
        });
    }
  }
  const granted = [...grantedMap.values()].sort(
    (a, b) => a.level - b.level || a.catalog.name.localeCompare(b.catalog.name),
  );

  // Recorded Spells.
  const recorded: RecordedSpell[] =
    casting.record === 'none'
      ? []
      : recordedFor(
          character,
          classKey,
          casting,
          highestLevel,
          school,
          grantedMap,
        );

  const rows: SlotRow[] = [];
  for (let l = 0; l <= 9; l++) {
    const base = cell(tables.spellsPerDay, castingLevel, l);
    const known = cell(tables.spellsKnown, castingLevel, l);
    const prepared = cell(tables.preparedPerDay, castingLevel, l);
    if (base === null && known === null && prepared === null) continue;
    const bonus = base !== null && l >= 1 ? bonusSpells(permanentScore, l) : 0;
    const extra = base !== null && l >= 1 && extraSlot ? 1 : 0;
    const dc = dcStat(l).total;
    rows.push({
      level: l,
      base,
      bonus,
      extra,
      perDay: base === null ? null : base + bonus + extra,
      known,
      prepared,
      recorded: recorded.filter((r) => r.level === l).length,
      granted: granted.filter((g) => g.level === l).length,
      dc,
      dcBySchool: dcSchools
        .map((sch) => ({ school: sch, dc: dcStat(l, sch).total }))
        .filter((x) => x.dc !== dc),
    });
  }

  return {
    classKey,
    className: name,
    casting,
    heading:
      casting.record === 'known'
        ? 'Spells known'
        : casting.record === 'book'
          ? (casting.bookName ?? 'Spellbook')
          : null,
    classLevels: own,
    advances,
    castingLevel,
    casterLevel,
    concentration,
    ability,
    abilityScore,
    abilityMod,
    permanentScore,
    highestLevel,
    rows,
    extraSlot,
    school,
    recorded,
    granted,
    dcStat,
  };
}

type SpellEntry = RecordedSpell['entry'];
const isSpellEntry = (e: SheetEntry): e is SpellEntry =>
  e.state.kind === 'spell';

function recordedFor(
  character: Character,
  classKey: string,
  casting: Casting,
  highestLevel: number | null,
  school: ResolvedSpellcasting['school'],
  grantedMap: Map<string, GrantedSpell>,
): RecordedSpell[] {
  return character.entries
    .filter(isSpellEntry)
    .filter((e) => e.state.castingClass === classKey)
    .flatMap((entry) => {
      const catalog = lookupCatalog(character, entry.catalogKey);
      if (!isSpellCatalog(catalog)) return [];
      const listLevel = catalog.detail.levels[casting.classTag];
      const grantedLevel = grantedMap.get(catalog.key)?.level;
      const onList = listLevel !== undefined;
      const level = onList ? listLevel : (grantedLevel ?? entry.state.level);
      return [
        {
          entry,
          catalog,
          level,
          onList,
          offList: !onList && grantedLevel === undefined,
          opposition: Boolean(
            school?.opposition.includes(catalog.detail.school),
          ),
          tooHigh:
            level !== null && (highestLevel === null || level > highestLevel),
        },
      ];
    })
    .sort(
      (a, b) =>
        (a.level ?? 99) - (b.level ?? 99) ||
        a.catalog.name.localeCompare(b.catalog.name),
    );
}

/** Recorded Spells whose casting class the Character has no levels in. */
export function orphanedSpells(character: Character) {
  const classes = new Set(castingClasses(character).map((c) => c.classKey));
  return character.entries
    .filter(isSpellEntry)
    .filter((e) => !classes.has(e.state.castingClass))
    .flatMap((entry) => {
      const catalog = lookupCatalog(character, entry.catalogKey);
      return isSpellCatalog(catalog)
        ? [{ entry, catalog, castingClass: entry.state.castingClass }]
        : [];
    });
}

// ------------------------------------------------------- the picker

export type SpellChoice = {
  catalog: SpellCatalog;
  /** Its level for this Spellcasting (class list), else its lowest level anywhere. */
  level: number | null;
  onList: boolean;
  /** Recorded for this Spellcasting: the entry id. */
  recordedEntryId: string | null;
  /** Granted to this Spellcasting (domain, bloodline). */
  granted: boolean;
  /** A granted domain Spell off the class list: preparable only in the domain slot. */
  domainSlotOnly: boolean;
  tooHigh: boolean;
  opposition: boolean;
};

/**
 * What a picker can offer for one Spellcasting: its class list plus any
 * recorded or granted Spell off it (and, with `offList`, every other
 * Spell), each with whether it is recorded, granted, too high or of an
 * opposition school. A granted off-list Spell carries its granted level.
 * Sorted: on the list first, then by level and name.
 */
export function spellChoices(
  character: Character,
  classKey: string,
  opts: { offList?: boolean } = {},
): SpellChoice[] {
  const sc = spellcastingsOf(character).find((s) => s.classKey === classKey);
  const casting = castingOf(classKey);
  if (!casting) return [];
  return SPELL_CATALOG.flatMap((catalog) => {
    const listLevel = catalog.detail.levels[casting.classTag];
    const onList = listLevel !== undefined;
    const rec = sc?.recorded.find((r) => r.catalog.key === catalog.key);
    const granted = sc?.granted.find((g) => g.catalog.key === catalog.key);
    // Recorded and granted Spells are always offered, on the list or not.
    if (!onList && !opts.offList && !rec && !granted) return [];
    const level = onList
      ? listLevel
      : (granted?.level ?? rec?.level ?? lowestLevel(catalog.detail));
    return [
      {
        catalog,
        level,
        onList,
        recordedEntryId: rec?.entry.id ?? null,
        granted: Boolean(granted),
        domainSlotOnly: Boolean(granted?.domainSlotOnly),
        tooHigh:
          level !== null &&
          (sc?.highestLevel == null || level > sc.highestLevel),
        opposition: Boolean(
          sc?.school?.opposition.includes(catalog.detail.school),
        ),
      },
    ];
  }).sort(
    (a, b) =>
      Number(b.onList) - Number(a.onList) ||
      (a.level ?? 99) - (b.level ?? 99) ||
      a.catalog.name.localeCompare(b.catalog.name),
  );
}

// ---------------------------------------------- Spell Effect pre-fill

/**
 * A Spell Effect's caster level pre-fill: the lowest caster level at which
 * any class can cast its Spell — per class in the Spell's `levels`, the
 * caster level at the first class level whose table has an entry ("0"
 * included) at that spell level. Without a Spell, `defaultCasterLevel`.
 */
export function prefillCasterLevel(effect: CatalogEntry): number {
  if (effect.detail.kind !== 'spellEffect') return 1;
  const spell = effect.detail.spellKey
    ? CATALOG.find(
        (c) => c.key === (effect.detail as { spellKey?: string }).spellKey,
      )
    : undefined;
  if (!isSpellCatalog(spell)) return effect.detail.defaultCasterLevel;
  return prefillFor(spell.detail) ?? effect.detail.defaultCasterLevel;
}

/** The pre-fill for one Spell, with the class that gives it. */
export function prefillFor(spell: SpellDetail): number | null {
  return prefillSource(spell)?.casterLevel ?? null;
}

export function prefillSource(spell: SpellDetail) {
  let best: {
    casterLevel: number;
    className: string;
    classLevel: number;
    spellLevel: number;
  } | null = null;
  for (const [tag, spellLevel] of Object.entries(spell.levels)) {
    const casting = CASTING_BY_TAG[tag];
    if (!casting || spellLevel === undefined) continue;
    const t = CASTING_TABLES[casting.table];
    for (let row = 1; row <= 20; row++) {
      const has =
        cell(t.spellsPerDay, row, spellLevel) !== null ||
        cell(t.spellsKnown, row, spellLevel) !== null ||
        cell(t.preparedPerDay, row, spellLevel) !== null;
      if (!has) continue;
      const cl = row + casting.casterLevelOffset;
      if (!best || cl < best.casterLevel)
        best = {
          casterLevel: cl,
          className: casting.name,
          classLevel: row,
          spellLevel,
        };
      break;
    }
  }
  return best;
}

// ----------------------------------------------------------- warnings

/**
 * The spell rules checks (data model "Rules checks"): spells known over the
 * table, Spell too high, off-list Spell, orphaned Spell, prestige advance,
 * opposition schools. All are `warning`s the player can accept; each has a
 * fingerprint of the facts that raised it.
 */
export function spellWarnings(character: Character): Warning[] {
  const out: Warning[] = [];
  const all = spellcastingsOf(character);
  for (const sc of all) {
    const where = `spellcasting:${sc.classKey}`;
    if (sc.casting.record === 'known')
      for (const row of sc.rows)
        if (row.known !== null && row.recorded > row.known)
          out.push({
            id: `spells-known-${sc.classKey}-${row.level}`,
            severity: 'warning',
            where,
            spellLevel: row.level,
            acceptable: true,
            fingerprint: `${row.recorded}/${row.known}`,
            message: `${sc.className}: ${row.recorded} ${levelText(row.level)} Spells known; the table allows ${row.known}.`,
          });
    for (const r of sc.recorded) {
      const name = r.catalog.name;
      if (r.offList)
        out.push({
          id: `spell-offlist-${r.entry.id}`,
          severity: 'warning',
          where: `entry:${r.entry.id}`,
          spellLevel: r.level ?? undefined,
          acceptable: true,
          fingerprint: `${sc.classKey}:${r.catalog.key}`,
          message:
            r.level === null
              ? `${name} isn’t on the ${sc.className.toLowerCase()} list: set its level.`
              : `${name} isn’t on the ${sc.className.toLowerCase()} list; recorded as ${levelText(r.level)}.`,
        });
      if (r.tooHigh)
        out.push({
          id: `spell-high-${r.entry.id}`,
          severity: 'warning',
          where: `entry:${r.entry.id}`,
          spellLevel: r.level ?? undefined,
          acceptable: true,
          fingerprint: `${r.level}>${sc.highestLevel}`,
          message:
            sc.highestLevel === null
              ? `${name} is ${levelText(r.level!)}; ${sc.className} can’t cast spells yet.`
              : `${name} is ${levelText(r.level!)}; ${sc.className} casts up to ${ordinal(sc.highestLevel)} level now.`,
        });
    }
    if (sc.school) {
      const { school, opposition } = sc.school;
      if (opposition.includes(school))
        out.push({
          id: `opposition-specialist-${sc.school.entryId}`,
          severity: 'warning',
          where,
          acceptable: true,
          fingerprint: opposition.join(','),
          message: `${SCHOOL_LABEL[school]} is the specialist school; it can’t be an opposition school.`,
        });
      if (opposition.length < 2)
        out.push({
          id: `opposition-count-${sc.school.entryId}`,
          severity: 'warning',
          where,
          acceptable: true,
          fingerprint: opposition.join(','),
          message: `${SCHOOL_LABEL[school]} specialist: choose two opposition schools (${opposition.length} chosen).`,
        });
    }
  }
  for (const o of orphanedSpells(character))
    out.push({
      id: `spell-orphaned-${o.entry.id}`,
      severity: 'warning',
      where: `entry:${o.entry.id}`,
      acceptable: true,
      fingerprint: o.castingClass,
      message: `${o.catalog.name} is recorded for ${className(o.castingClass)}, but there are no ${className(o.castingClass)} levels.`,
    });
  // Prestige advances.
  for (const level of classLevels(character)) {
    const choices = advanceChoices(character, level.id);
    const label = classLevelShortLabel(character, level.id);
    for (const choice of choices) {
      if (!choice.value) continue;
      const to = castingOf(choice.value);
      const first = classLevels(character).find(
        (l) => l.state.classKey === choice.value,
      );
      if (to && choice.kind !== 'any' && to.spellKind !== choice.kind)
        out.push({
          id: `advance-kind-${level.id}-${choice.index}`,
          severity: 'warning',
          where: `classLevel:${level.id}`,
          acceptable: true,
          fingerprint: choice.value,
          message: `${label}: an ${choice.kind} advance on ${className(choice.value)}, a ${to.spellKind} Spellcasting.`,
        });
      const firstPrestige = firstPositionOf(character, level.state.classKey);
      if (!first || first.state.position > firstPrestige)
        out.push({
          id: `advance-later-${level.id}-${choice.index}`,
          severity: 'warning',
          where: `classLevel:${level.id}`,
          acceptable: true,
          fingerprint: choice.value,
          message: `${label}: its advance goes to ${className(choice.value)}, first taken after ${className(level.state.classKey)} 1.`,
        });
    }
  }
  return out;
}

/** Display text for the castDefensively situation (Combat Casting). */
export const CAST_DEFENSIVELY_TEXT = SITUATION_TEXT.castDefensively;
